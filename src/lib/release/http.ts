import { ownerFromRequest } from "../projects/publish-owner.ts";
import { createReleaseJob, loadReleaseJob, releaseAccounts, resumeReleaseJob } from "./engine.ts";
import type { PublicReleaseJob, ReleaseInput } from "./types.ts";

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
