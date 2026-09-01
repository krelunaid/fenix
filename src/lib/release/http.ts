import { ownerFromRequest } from "../projects/publish-owner.ts";
import { callbackSecret, verifyReleaseCallback } from "./dispatch.ts";
import { createReleaseJob, loadReleaseJob, releaseAccounts, resumeReleaseJob } from "./engine.ts";
import { readReleaseJob, writeReleaseJob } from "./store.ts";
import type { Platform, PublicReleaseJob, ReleaseInput, ReleaseStep } from "./types.ts";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isFail(
  value: PublicReleaseJob | { error: string; status: number },
): value is { error: string; status: number } {
  return typeof (value as { status?: unknown }).status === "number";
}

export async function handleReleaseCollection(request: Request): Promise<Response> {
  if (request.method === "GET") {
    return json(releaseAccounts());
  }
  if (request.method === "POST") {
    const ownerId = ownerFromRequest(request);
    if (!ownerId) return json({ error: "Identità assente." }, 401);
    let body: ReleaseInput = {};
    try {
      body = (await request.json()) as ReleaseInput;
    } catch {
      return json({ error: "JSON non valido." }, 400);
    }
    const idem =
      request.headers.get("x-fenix-idempotency") || request.headers.get("idempotency-key");
    const result = await createReleaseJob(body, { ownerId, idempotencyKey: idem });
    if (isFail(result)) return json({ error: result.error }, result.status);
    return json(result, 201);
  }
  return json({ error: "Metodo non consentito." }, 405);
}

export async function handleReleaseItem(request: Request, id: string): Promise<Response> {
  const ownerId = ownerFromRequest(request);
  if (!ownerId) return json({ error: "Identità assente." }, 401);
  if (request.method === "GET") {
    const result = await loadReleaseJob(id, { ownerId });
    if (isFail(result)) return json({ error: result.error }, result.status);
    return json(result);
  }
  if (request.method === "POST") {
    const result = await resumeReleaseJob(id, { ownerId });
    if (isFail(result)) return json({ error: result.error }, result.status);
    return json(result);
  }
  return json({ error: "Metodo non consentito." }, 405);
}

export async function handleReleaseCallback(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Metodo non consentito." }, 405);
  const secret = callbackSecret();
  if (!secret) return json({ error: "Callback non configurata." }, 503);
  let body: {
    jobId?: string;
    runId?: string;
    platform?: Platform;
    step?: ReleaseStep;
    status?: string;
    artifact?: string;
    error?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "JSON non valido." }, 400);
  }
  const signature =
    request.headers.get("x-fenix-release-signature") || request.headers.get("x-signature") || "";
  if (
    !body.jobId ||
    !body.runId ||
    !body.status ||
    !verifyReleaseCallback({
      jobId: body.jobId,
      runId: body.runId,
      status: body.status,
      signature,
      secret,
    })
  ) {
    return json({ error: "Firma callback non valida." }, 401);
  }
  const job = await readReleaseJob(body.jobId);
  if (!job) return json({ error: "Job non trovato." }, 404);
  const platform = body.platform;
  if (platform && job.tracks[platform]) {
    const t = job.tracks[platform]!;
    t.provider = {
      ...t.provider,
      runId: body.runId,
      inflight: body.status === "ok" || body.status === "err" ? undefined : t.provider?.inflight,
    };
    if (body.artifact) t.artifact = body.artifact;
    if (body.status === "err") {
      t.status = "err";
      t.error = body.error || "Worker native fallito.";
      job.status = "err";
      job.error = t.error;
    }
    job.tracks[platform] = t;
  }
  await writeReleaseJob(job);
  return json({ ok: true });
}
