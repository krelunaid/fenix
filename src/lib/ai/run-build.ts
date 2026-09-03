import type { StreamEvent } from "./stages";
import {
  applyBuildResult,
  promoteReady,
  refundBuildCredit,
  RESUME_ERROR,
  useProjectStore,
} from "@/lib/projects/store";
import { parseBuildOutput, type BuildResult } from "./parse";
import { isWeakPreview, lookInstruction, resetAudit, waitPreviewAudit, waitPreviewShot, waitPreviewBoot, getPreviewBootError, getPreviewBootOk, rememberBootError } from "./look";
import { APP_SHELL_HTML, DASHBOARD_POLISH_INSTRUCTION, SITE_POLISH_INSTRUCTION } from "./app-shell";
import { composeProduct } from "./compose-product";
import { CREATE_COST, ITERATE_COST } from "@/lib/projects/credits";
import { isPhoneKind, resolveProjectKind } from "@/lib/projects/infer";
import { formatHtmlErrors, validateProductHtml } from "@/lib/projects/validate-html";
import {
  clearVisualJobPatch,
  dropLiveJobLogs,
  hasActiveVisualJob,
  isJobSentinelError,
  JOB_STILL_RUNNING,
  mergeUniqueLogs,
  uniqueLogs,
  VISUAL_JOB_TTL_MS,
  visualJobPatch,
} from "@/lib/projects/visual-job";
import {
  STALE_JOB,
  captureStableSnapshot,
  isCurrentBuild,
  nextBuildEpoch,
  readPersistedBuild,
  restoreStablePatch,
} from "@/lib/projects/studio-lock";
import { uid } from "@/lib/utils";

const inflight = new Set<string>();
/** A successful polishDraft for this project in the current runBuild. Blocks a second POST. */
const polishedOnce = new Set<string>();

export const WORKER_POLL_MAX = 30;
const WORKER_POLL_MS = 2000;
/** 2s ticks while a persisted job is live. Overlay stays locked. */
export const WORKER_JOB_POLL_MAX = 180;
/** Match the visible promise: generation never owns the UI for more than 10 min. */
const GENERATE_POLL_MAX = 300;
export const BOOT_REPAIR_MAX = 2;

function isTransientNetwork(msg: string) {
  return /load failed|failed to fetch|network error|timeout|aborted|ERR_NETWORK|Failed to fetch/i.test(
    String(msg || ""),
  );
}

function stillCurrent(projectId: string, epoch: number, jobId?: string): boolean {
  const live = useProjectStore.getState().getProject(projectId);
  return isCurrentBuild(live, epoch, jobId, readPersistedBuild(projectId));
}

function abandonVisualJob(projectId: string, raw: string) {
  const store = useProjectStore.getState();
  const current = store.getProject(projectId);
  const boot = getPreviewBootError()?.message;
  let human = String(raw || "").trim();
  if (isJobSentinelError(human) || !human) {
    if (boot) human = `Errore in avvio: ${boot}`;
    else if (current?.html) {
      const report = validateProductHtml(current.html, { kind: current.kind });
      human = report.ok ? RESUME_ERROR : formatHtmlErrors(report) || RESUME_ERROR;
    } else {
      human = RESUME_ERROR;
    }
  }
  store.updateProject(projectId, {
    status: "error",
    error: human,
    buildLog: dropLiveJobLogs(current?.buildLog ?? []),
    ...clearVisualJobPatch(),
    ...restoreStablePatch(current),
  });
  const last = current?.messages[current.messages.length - 1];
  if (last?.role === "assistant" && last.content === human) return;
  store.addMessage(projectId, { id: uid(), role: "assistant", content: human });
}

const WORKER_POLISH =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: { VITE_VISUAL_WORKER_URL?: string } }).env?.VITE_VISUAL_WORKER_URL?.replace(/\/$/, "")) ||
  "https://fenix-production-d9f5.up.railway.app";

async function delay(ms: number) {
  await new Promise((r) => {
    if (typeof window !== "undefined") window.setTimeout(r, ms);
    else setTimeout(r, ms);
  });
}

type WorkerJob = {
  id?: string;
  status?: string;
  html?: string;
  meta?: Record<string, unknown>;
  log?: string[];
  files?: { path: string; content: string }[];
  error?: string;
};

function polishUrls() {
  const base = WORKER_POLISH.replace(/\/$/, "");
  return [`/__worker/polish`, `${base}/polish`, `/api/polish`];
}

function jobUrls(id: string) {
  const base = WORKER_POLISH.replace(/\/$/, "");
  return [`/__worker/jobs/${id}`, `${base}/jobs/${id}`, `/api/jobs/${id}`];
}

type JobFetch =
  | { state: "job"; job: WorkerJob }
  | { state: "missing" }
  | { state: "retry" };

async function fetchJob(id: string): Promise<JobFetch> {
  let missing = false;
  let retry = false;
  for (const url of jobUrls(id)) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.status === 404) {
        missing = true;
        continue;
      }
      if (!r.ok) {
        retry = true;
        continue;
      }
      return { state: "job", job: (await r.json()) as WorkerJob };
    } catch {
      retry = true;
    }
  }
  if (missing) return { state: "missing" };
  return { state: "retry" };
}

const JOB_GONE = "Job visivo non trovato. Tocca Riprendi rifinitura.";

async function pollWorkerJob(projectId: string, jobId: string, epoch: number): Promise<WorkerJob> {
  const store = useProjectStore.getState();
  const existing = store.getProject(projectId);
  const started = existing?.visualJobStartedAt ?? Date.now();
  store.updateProject(projectId, {
    ...visualJobPatch(jobId, "run", started),
    status: "building",
    error: undefined,
    buildLog: uniqueLogs(existing?.buildLog),
  });
  const deadline = started + VISUAL_JOB_TTL_MS;
  let ticks = 0;
  let misses = 0;
  while (Date.now() < deadline) {
    ticks += 1;
    if (!stillCurrent(projectId, epoch, jobId)) throw new Error(STALE_JOB);
    const fetched = await fetchJob(jobId);
    if (fetched.state === "missing") {
      throw new Error(JOB_GONE);
    }
    if (fetched.state === "retry") {
      misses += 1;
      if (misses >= 3) throw new Error(JOB_GONE);
    } else {
      misses = 0;
      const job = fetched.job;
      if (Array.isArray(job.log) && job.log.length) {
        const current = store.getProject(projectId);
        const prev = current?.buildLog ?? [];
        const merged = mergeUniqueLogs(prev, job.log);
        if (merged.length !== prev.length) {
          store.updateProject(projectId, { buildLog: merged });
        }
      }
      if (job.status === "ok" && job.html) {
        if (!stillCurrent(projectId, epoch, jobId)) throw new Error(STALE_JOB);
        return job;
      }
      if (job.status === "err" || (job.status === "ok" && !job.html)) {
        throw new Error(`${job.error || "Worker visivo fallito"}. Tocca Riprendi rifinitura.`);
      }
      if (ticks === WORKER_POLL_MAX || ticks === WORKER_JOB_POLL_MAX) {
        const current = store.getProject(projectId);
        const prev = current?.buildLog ?? [];
        const merged = mergeUniqueLogs(prev, ["Motore visivo ancora in corso"]);
        if (merged.length !== prev.length) {
          store.updateProject(projectId, {
            status: "building",
            error: undefined,
            buildLog: merged,
          });
        }
      }
    }
    await delay(WORKER_POLL_MS);
  }
  const last = await fetchJob(jobId);
  if (!stillCurrent(projectId, epoch, jobId)) throw new Error(STALE_JOB);
  if (last.state === "job" && last.job.status === "ok" && last.job.html) return last.job;
  if (last.state === "job" && last.job.status === "err") {
    throw new Error(`${last.job.error || "Worker visivo fallito"}. Tocca Riprendi rifinitura.`);
  }
  if (last.state !== "job") throw new Error(JOB_GONE);
  throw new Error(JOB_STILL_RUNNING);
}

async function startPolishJob(
  projectId: string,
  prompt: string,
  html: string,
  instruction: string | undefined,
  epoch: number,
): Promise<WorkerJob> {
  const store = useProjectStore.getState();
  const project = store.getProject(projectId);
  if (project && hasActiveVisualJob(project) && project.visualJobId) {
    return pollWorkerJob(projectId, project.visualJobId, epoch);
  }
  if (polishedOnce.has(projectId) && !instruction && project?.html) {
    return {
      status: "ok",
      html: project.html,
      log: ["Anteprima già rifinita"],
      files: project.files,
    };
  }

  const body = JSON.stringify({
    prompt,
    html,
    instruction: instruction || undefined,
    kind: resolveProjectKind({
      stored: project?.kind,
      requested: project?.requestedKind,
      prompt: project?.prompt ?? prompt,
    }),
    projectId,
    jobId: project?.visualJobId,
    idempotencyKey: project?.visualJobId || projectId,
  });
  let lastErr = "Load failed";
  let jobId: string | undefined;
  for (const url of polishUrls()) {
    try {
      const started = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": projectId,
        },
        body,
      });
      if (started.status === 202) {
        const payload = (await started.json()) as { id?: string };
        if (!payload.id) {
          lastErr = "Worker senza job id";
          continue;
        }
        jobId = payload.id;
        store.updateProject(projectId, {
          ...visualJobPatch(jobId, "run"),
          status: "building",
          error: undefined,
        });
        break;
      }
      if (!started.ok) {
        lastErr = `Worker HTTP ${started.status}`;
        continue;
      }
      return (await started.json()) as WorkerJob;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "Load failed";
    }
  }
  if (jobId) return pollWorkerJob(projectId, jobId, epoch);
  throw new Error(lastErr);
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iP(hone|od|ad)/.test(navigator.userAgent);
}

async function consumeViaWorker(
  projectId: string,
  body: { prompt: string; html?: string; instruction?: string; kind?: string },
  quiet = false,
  epoch = 0,
): Promise<boolean> {
  const store = useProjectStore.getState();
  const bases = ["/__worker", WORKER_POLISH.replace(/\/$/, "")];
  let lastErr = "Load failed";
  let proxyAnswered = false;
  for (const base of bases) {
    if (base !== "/__worker" && proxyAnswered) continue;
    try {
      const started = await fetch(`${base}/build`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": projectId,
        },
        body: JSON.stringify({ ...body, projectId }),
        signal: AbortSignal.timeout(8000),
      });
      if (base === "/__worker") proxyAnswered = true;
      if (started.status !== 202) {
        lastErr = `Build HTTP ${started.status}`;
        continue;
      }
      const { id } = (await started.json()) as { id?: string };
      if (!id) continue;
      store.updateProject(projectId, {
        ...visualJobPatch(id, "run"),
        status: "building",
        error: undefined,
      });
      for (let i = 0; i < GENERATE_POLL_MAX; i++) {
        await delay(WORKER_POLL_MS);
        const fetched = await fetchJob(id);
        if (fetched.state === "missing") throw new Error(JOB_GONE);
        if (fetched.state === "retry") continue;
        const job = fetched.job;
        if (job.log?.length) {
          const live = useProjectStore.getState().getProject(projectId);
          store.updateProject(projectId, { buildLog: mergeUniqueLogs(live?.buildLog, job.log) });
        }
        if (job.status === "ok" && job.html) {
          if (!stillCurrent(projectId, epoch, id)) throw new Error(STALE_JOB);
          const current = useProjectStore.getState().getProject(projectId);
          const lockKind = resolveProjectKind({
            stored: current?.kind,
            requested: current?.requestedKind,
            prompt: current?.prompt ?? body.prompt,
          });
          const result = parseBuildOutput(
            `<<<META>>>\n${JSON.stringify(job.meta ?? {})}\n<<<HTML>>>\n${job.html}\n<<<END>>>`,
            lockKind,
            current?.prompt ?? body.prompt,
          );
          if (!result) throw new Error("Risposta non valida");
          resetAudit();
          const report = applyBuildResult(projectId, result, "building");
          store.updateProject(projectId, { ...clearVisualJobPatch(), status: "building" });
          if (!report.syntaxOk) throw new Error(formatHtmlErrors(report) || "HTML non valido");
          if (!quiet) {
            store.addMessage(projectId, {
              id: uid(),
              role: "assistant",
              content: `${result.name} ricevuto. Controllo l'avvio. Pubblica resta chiusa.`,
            });
          }
          return true;
        }
        if (job.status === "err") throw new Error(job.error || "Build fallita");
      }
      throw new Error(JOB_STILL_RUNNING);
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "Load failed";
      if (lastErr === JOB_STILL_RUNNING || lastErr === JOB_GONE) {
        throw err instanceof Error ? err : new Error(lastErr);
      }
    }
  }
  throw new Error(lastErr);
}

async function consumeStream(
  projectId: string,
  body: { prompt: string; html?: string; instruction?: string; shot?: string },
  quiet = false,
  epoch = 0,
): Promise<boolean> {
  const store = useProjectStore.getState();
  const recentPalettes = store.recentPalettes ?? [];
  const res = await fetch("/api/build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, recentPalettes }),
  });

  if (!res.ok || !res.body) {
    return false;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      let event: StreamEvent;
      try {
        event = JSON.parse(line.slice(5).trim()) as StreamEvent;
      } catch {
        continue;
      }
      if (event.t === "s") {
        if (!stillCurrent(projectId, epoch)) continue;
        const current = useProjectStore.getState().getProject(projectId);
        const log = current?.buildLog ?? [];
        if (log[log.length - 1] !== event.s) {
          store.updateProject(projectId, { buildLog: [...log, event.s] });
        }
      } else if (event.t === "ok") {
        if (!stillCurrent(projectId, epoch)) throw new Error(STALE_JOB);
        const result = event.result as BuildResult;
        const report = applyBuildResult(projectId, result, "building");
        if (!report.syntaxOk) {
          store.updateProject(projectId, {
            status: "error",
            error: formatHtmlErrors(report) || "HTML non valido",
          });
          store.addMessage(projectId, {
            id: uid(),
            role: "assistant",
            content: formatHtmlErrors(report) || "HTML non valido. Non pubblico.",
          });
        } else if (!quiet) {
          store.addMessage(projectId, {
            id: uid(),
            role: "assistant",
            content: `${result.name} ricevuto. Controllo l'avvio. Pubblica resta chiusa.`,
          });
        }
        finished = true;
      } else if (event.t === "err") {
        if (!stillCurrent(projectId, epoch)) throw new Error(STALE_JOB);
        const salvage = event.result as BuildResult | undefined;
        if (salvage && typeof salvage === "object" && salvage.html) {
          applyBuildResult(projectId, salvage, "building");
          store.updateProject(projectId, { status: "error", error: event.error });
          store.addMessage(projectId, {
            id: uid(),
            role: "assistant",
            content: event.error,
          });
          finished = true;
        } else if (isTransientNetwork(event.error || "")) {
          throw new Error(event.error || "network error");
        } else {
          store.updateProject(projectId, { status: "error", error: event.error });
          store.addMessage(projectId, {
            id: uid(),
            role: "assistant",
            content: event.error,
          });
          finished = true;
        }
      }
    }
  }

  return finished;
}

async function polishDraft(
  projectId: string,
  prompt: string,
  html: string,
  instruction: string | undefined,
  epoch: number,
) {
  const store = useProjectStore.getState();
  let lastValidHtml = html;
  try {
    const data = await startPolishJob(projectId, prompt, html, instruction, epoch);
    const fileBlocks = (data?.files ?? [])
      .map((f) => `<<<FILE path="${f.path}">>>\n${f.content}`)
      .join("\n");
    const existing = useProjectStore.getState().getProject(projectId);
    const lockKind = resolveProjectKind({
      stored: existing?.kind,
      requested: existing?.requestedKind,
      prompt: existing?.prompt ?? prompt,
    });
    const result =
      data &&
      parseBuildOutput(
        `<<<META>>>\n${JSON.stringify(data.meta ?? {})}\n${fileBlocks}\n<<<HTML>>>\n${data.html ?? ""}\n<<<END>>>`,
        lockKind,
        existing?.prompt ?? prompt,
      );
    if (result?.html) {
      if (!stillCurrent(projectId, epoch)) throw new Error(STALE_JOB);
      resetAudit();
      const report = applyBuildResult(projectId, result, "building");
      if (report.syntaxOk) {
        lastValidHtml = result.html;
        const logs = data?.log ?? [];
        store.updateProject(projectId, {
          ...clearVisualJobPatch(),
          buildLog: uniqueLogs([
            ...dropLiveJobLogs(useProjectStore.getState().getProject(projectId)?.buildLog ?? []),
            ...logs,
            "Anteprima rifinita",
          ]),
        });
        polishedOnce.add(projectId);
        store.addMessage(projectId, {
          id: uid(),
          role: "assistant",
          content: [
            `Motore visivo: ${logs.length ? logs.join(" · ") : "icone e rifinitura"}.`,
            "Controllo l'avvio in anteprima. Pubblica resta chiusa.",
          ].join("\n\n"),
        });
      } else {
        store.updateProject(projectId, {
          html: lastValidHtml,
          status: "building",
          ...clearVisualJobPatch(),
        });
        store.addMessage(projectId, {
          id: uid(),
          role: "assistant",
          content: `Rifinitura scartata (JS non valido). Resta la bozza valida. ${formatHtmlErrors(report)}`,
        });
      }
    }
  } catch (err) {
    const workerError = err instanceof Error ? err.message : "errore";
    if (workerError === STALE_JOB) throw err instanceof Error ? err : new Error(STALE_JOB);
    if (workerError === JOB_STILL_RUNNING) {
      const current = useProjectStore.getState().getProject(projectId);
      if (current?.visualJobId) {
        store.updateProject(projectId, { status: "building", error: undefined });
      }
      throw err instanceof Error ? err : new Error(workerError);
    }
    if (/Riprendi rifinitura/i.test(workerError)) {
      abandonVisualJob(projectId, workerError);
      throw err instanceof Error ? err : new Error(workerError);
    }
    store.addMessage(projectId, {
      id: uid(),
      role: "assistant",
      content: `Motore visivo non ha risposto (${workerError}). Uso gli sguardi in pagina.`,
    });
  }
  return lastValidHtml;
}

async function settlePreviewBoot(projectId: string): Promise<string | null> {
  const project = useProjectStore.getState().getProject(projectId);
  if (!project?.html) return "HTML assente.";
  const report = validateProductHtml(project.html, { kind: project.kind });
  const staticErr = report.ok ? null : formatHtmlErrors(report);
  const boot = await waitPreviewBoot(staticErr ? 500 : 5000);
  if (boot.error) return boot.error;
  if (staticErr) return staticErr;
  if (!boot.ok && !getPreviewBootOk()) return "Avvio senza segnale";
  return null;
}

async function repairBootFailures(projectId: string, prompt: string, epoch: number): Promise<boolean> {
  const store = useProjectStore.getState();
  let firstReason: string | null = null;
  for (let attempt = 0; attempt < BOOT_REPAIR_MAX; attempt++) {
    if (!stillCurrent(projectId, epoch)) return false;
    const reason = await settlePreviewBoot(projectId);
    if (!reason) return true;
    firstReason = firstReason || reason;
    const current = store.getProject(projectId);
    if (!current?.html) return false;
    store.updateProject(projectId, {
      status: "building",
      error: undefined,
      buildLog: [...(current.buildLog ?? []), attempt === 0 ? "Riparo il codice" : "Secondo riparo"],
    });
    const before = current.html;
    resetAudit();
    await consumeStream(
      projectId,
      {
        prompt,
        html: current.html,
        instruction: [
          `ERRORE DI AVVIO: ${reason}`,
          "Non usare .orders su stato nullo. Sito/landing: niente scaffold gestionale (orders, inventario, Nuovo pezzo).",
          "Stato iniziale = oggetto vuoto, mai null. META+HTML completo.",
          "Non assegnare .innerHTML o .textContent a querySelector/getElementById senza if (el).",
          "Non patchare template t-home/t-new o tab se quei nodi non esistono nel DOM.",
          "Se Fenix.data usa un nome con spazi/slash/accenti, rinominalo in un token [A-Za-z0-9._-]{1,80} (es. capi).",
        ].join("\n"),
      },
      true,
      epoch,
    );
    const after = store.getProject(projectId)?.html;
    if (after === before) {
      rememberBootError(firstReason);
      return false;
    }
  }
  const last = await settlePreviewBoot(projectId);
  if (!last) return true;
  rememberBootError(last || firstReason || "Errore in avvio");
  return false;
}

function finishPolish(projectId: string, lastValidHtml: string, refund?: number) {
  const store = useProjectStore.getState();
  const boot = getPreviewBootError();
  const canaryOk = getPreviewBootOk();
  const promoted = promoteReady(projectId);
  if (promoted.ok && !boot && canaryOk) {
    const current = store.getProject(projectId);
    const withoutPronto = (current?.messages || []).filter(
      (m) => !/^Pronto\./.test(String(m.content || "")),
    );
    store.updateProject(projectId, {
      ...clearVisualJobPatch(),
      status: "ready",
      error: undefined,
      messages: withoutPronto,
      lastStableHtml: current?.html,
      lastStableFiles: current?.files,
    });
    store.addMessage(projectId, {
      id: uid(),
      role: "assistant",
      content: current?.name
        ? `Pronto. ${current.name} è in anteprima e si usa.\n\nAnteprima e Pubblica sono attive.`
        : "Pronto. Anteprima e Pubblica sono attive.",
    });
    return true;
  }
  if (refund) refundBuildCredit(projectId, refund);
  const detail = boot?.message || (!canaryOk ? "Avvio senza segnale" : formatHtmlErrors(promoted) || RESUME_ERROR);
  const failed = store.getProject(projectId);
  const restored = restoreStablePatch(failed);
  store.updateProject(projectId, {
    html: restored.html ?? lastValidHtml,
    ...(restored.files ? { files: restored.files } : {}),
    status: "error",
    error: boot ? `Errore in avvio: ${boot.message}` : `Errore in avvio: ${detail}`,
    ...clearVisualJobPatch(),
  });
  store.addMessage(projectId, {
    id: uid(),
    role: "assistant",
    content: refund
      ? `Non pubblico: ${detail}. Credito rimborsato.`
      : detail,
  });
  return false;
}

/** Riprende la rifinitura senza spendere crediti. Overlay e polling restano bounded. */
export async function resumePolish(projectId: string) {
  if (inflight.has(projectId)) return;
  inflight.add(projectId);
  const store = useProjectStore.getState();
  const project = store.getProject(projectId);
  if (!project?.html) {
    inflight.delete(projectId);
    return;
  }
  if (project.status === "ready") {
    inflight.delete(projectId);
    return;
  }
  const kind = resolveProjectKind({
    stored: project.kind,
    requested: project.requestedKind,
    prompt: project.prompt,
  });
  const live = Boolean(hasActiveVisualJob(project) && project.visualJobId);
  const epoch = live ? (project.buildEpoch ?? 1) : nextBuildEpoch(project.buildEpoch);
  const snap = captureStableSnapshot(project);
  store.updateProject(projectId, {
    kind,
    requestedKind: project.requestedKind ?? kind,
    status: "building",
    error: undefined,
    buildEpoch: epoch,
    ...snap,
    buildLog: live
      ? uniqueLogs(project.buildLog)
      : mergeUniqueLogs(project.buildLog ?? [], ["Riprendo rifinitura"]),
  });
  try {
    const phoneShell = /\bfk-tab\b/.test(project.html);
    const instruction =
      kind === "dashboard" && phoneShell
        ? DASHBOARD_POLISH_INSTRUCTION
        : kind === "site" || kind === "landing"
          ? SITE_POLISH_INSTRUCTION
          : undefined;
    const lastValidHtml = await polishDraft(projectId, project.prompt, project.html, instruction, epoch);
    const latest = useProjectStore.getState().getProject(projectId);
    if (hasActiveVisualJob(latest ?? {})) return;
    if (!stillCurrent(projectId, epoch)) return;
    const booted = await repairBootFailures(projectId, project.prompt, epoch);
    if (!booted) {
      refundBuildCredit(projectId, CREATE_COST);
      finishPolish(projectId, lastValidHtml, CREATE_COST);
      return;
    }
    finishPolish(projectId, lastValidHtml);
  } catch (err) {
    const message = err instanceof Error ? err.message : RESUME_ERROR;
    if (message === STALE_JOB) return;
    if (message === JOB_STILL_RUNNING) {
      refundBuildCredit(projectId, CREATE_COST);
      abandonVisualJob(projectId, RESUME_ERROR);
      return;
    }
    refundBuildCredit(projectId, CREATE_COST);
    abandonVisualJob(projectId, message);
  } finally {
    inflight.delete(projectId);
  }
}

export async function runBuild(projectId: string, instruction?: string) {
  if (inflight.has(projectId)) return;
  inflight.add(projectId);
  polishedOnce.delete(projectId);

  const store = useProjectStore.getState();
  const project = store.getProject(projectId);
  if (!project) {
    inflight.delete(projectId);
    return;
  }

  const cost = instruction ? ITERATE_COST : CREATE_COST;
  if (!store.spendCredit(cost)) {
    store.updateProject(projectId, {
      status: "error",
      error: "Crediti esauriti. Il tetto di questa sessione è finito.",
    });
    store.addMessage(projectId, {
      id: uid(),
      role: "assistant",
      content: "Crediti esauriti. Una creazione usa 4 crediti, una modifica 2.",
    });
    inflight.delete(projectId);
    return;
  }

  store.recordActivity(projectId, {
    kind: "build",
    outcome: "run",
    label: instruction ? "Modifica avviata" : "Build avviata",
    metrics: { credits: cost },
  });

  const epoch = nextBuildEpoch(project.buildEpoch);
  const snap = captureStableSnapshot(project);
  store.updateProject(projectId, {
    status: "building",
    error: undefined,
    buildLog: [],
    creditRefunded: false,
    buildEpoch: epoch,
    ...snap,
  });
  resetAudit();
  store.addMessage(projectId, {
    id: uid(),
    role: "assistant",
    content: instruction
      ? `Ok. Applico: ${instruction.slice(0, 140)}`
      : "Ok. Lo costruisco. Circa 5–10 minuti: schermate, icone, foto. Pazienza, non chiudere.",
  });

  let charged = true;
  try {
    let streamed = false;
    const kind = resolveProjectKind({
      stored: project.kind,
      requested: project.requestedKind,
      prompt: project.prompt,
    });
    const phone = isPhoneKind(kind);
    const desk = kind === "site" || kind === "landing" || kind === "dashboard";
    const composed = composeProduct(project.prompt);
    const payload = {
      prompt: project.prompt,
      html: instruction
        ? project.html
        : composed.spec
          ? composed.html
          : phone
            ? APP_SHELL_HTML
            : project.html || "",
      kind,
      instruction: instruction || composed.polish,
    };
    try {
      streamed = isIOS() || desk
        ? await consumeViaWorker(projectId, payload, true, epoch)
        : await consumeStream(projectId, payload, true, epoch);
    } catch (first) {
      const msg = first instanceof Error ? first.message : "";
      if (msg === STALE_JOB) throw first;
      if (msg === JOB_STILL_RUNNING) throw first;
      if (isTransientNetwork(msg)) {
        streamed = await consumeViaWorker(projectId, payload, true, epoch);
      } else if (isIOS() || desk) {
        streamed = await consumeStream(projectId, payload, true, epoch);
      } else {
        throw first;
      }
    }
    if (streamed) {
      const latest = useProjectStore.getState().getProject(projectId);
      if (latest?.status === "error") {
        refundBuildCredit(projectId, cost);
        charged = false;
        store.updateProject(projectId, restoreStablePatch(latest));
        return;
      }
      if (latest?.html) {
        const draftCheck = validateProductHtml(latest.html, { kind: latest.kind });
        if (!draftCheck.syntaxOk) {
          refundBuildCredit(projectId, cost);
          charged = false;
          store.updateProject(projectId, {
            ...restoreStablePatch(latest),
            status: "error",
            error: formatHtmlErrors(draftCheck) || "HTML non valido",
          });
          store.addMessage(projectId, {
            id: uid(),
            role: "assistant",
            content: `Non pubblico: ${formatHtmlErrors(draftCheck)}. Credito rimborsato.`,
          });
          return;
        }
        const booted = await repairBootFailures(projectId, project.prompt, epoch);
        if (!booted) {
          if (!stillCurrent(projectId, epoch)) return;
          refundBuildCredit(projectId, cost);
          charged = false;
          const reason =
            getPreviewBootError()?.message ||
            formatHtmlErrors(validateProductHtml(latest.html, { kind: latest.kind })) ||
            "Errore in avvio";
          const restored = restoreStablePatch(useProjectStore.getState().getProject(projectId));
          store.updateProject(projectId, {
            ...(restored.html ? restored : {}),
            status: "error",
            error: `Errore in avvio: ${reason}`,
            ...clearVisualJobPatch(),
          });
          store.addMessage(projectId, {
            id: uid(),
            role: "assistant",
            content: `Non pubblico: ${reason}. Credito rimborsato.`,
          });
          return;
        }
        store.updateProject(projectId, {
          status: "building",
          buildLog: [...(useProjectStore.getState().getProject(projectId)?.buildLog ?? []), "Motore visivo in sottofondo"],
        });
        store.addMessage(projectId, {
          id: uid(),
          role: "assistant",
          content: instruction
            ? "Bozza valida in anteprima. Il motore visivo rifinisce (icone, 5–10 min). Pubblica resta chiusa finché non è pronto."
            : "Bozza valida in anteprima. Il motore visivo rifinisce in sottofondo. Pubblica resta chiusa finché non è pronto.",
        });
        let lastValidHtml = await polishDraft(
          projectId,
          project.prompt,
          latest.html,
          instruction ||
            (kind === "site" || kind === "landing"
              ? SITE_POLISH_INSTRUCTION
              : instruction),
          epoch,
        );

        if (!(instruction || isIOS()) && phone) {
          const look = async (label: string) => {
            const current = useProjectStore.getState().getProject(projectId);
            const snapshot = current?.html;
            if (!snapshot) return false;
            store.updateProject(projectId, {
              status: "building",
              buildLog: [...(current.buildLog ?? []), label],
            });
            const shot = await waitPreviewShot(5500);
            const audit = await waitPreviewAudit(500);
            if (!shot && !isWeakPreview(audit)) return false;
            await consumeStream(
              projectId,
              {
                prompt: project.prompt,
                html: snapshot,
                instruction: lookInstruction(audit, Boolean(shot)),
                shot: shot || undefined,
              },
              true,
              epoch,
            );
            const after = useProjectStore.getState().getProject(projectId);
            const afterReport = after?.html
              ? validateProductHtml(after.html, { kind: after.kind })
              : { syntaxOk: false };
            if (!afterReport.syntaxOk) {
              store.updateProject(projectId, {
                status: "building",
                error: undefined,
                html: snapshot,
              });
              return false;
            }
            lastValidHtml = after?.html || lastValidHtml;
            resetAudit();
            return true;
          };

          await Promise.race([
            look("Guardo i pixel"),
            new Promise((r) => window.setTimeout(r, 20000)),
          ]);
          await new Promise((r) => window.setTimeout(r, 800));
          const second = await waitPreviewAudit(1800);
          if (isWeakPreview(second)) {
            await look("Secondo sguardo");
          }
        }

        const canary = await repairBootFailures(projectId, project.prompt, epoch);
        if (!stillCurrent(projectId, epoch)) return;
        charged = !finishPolish(projectId, lastValidHtml, canary ? undefined : cost);
        return;
      }
      return;
    }

    refundBuildCredit(projectId, cost);
    charged = false;
    store.updateProject(projectId, {
      ...restoreStablePatch(useProjectStore.getState().getProject(projectId)),
      status: "error",
      error: "Non è arrivata una risposta. Riprova.",
    });
    store.addMessage(projectId, {
      id: uid(),
      role: "assistant",
      content: "Non è arrivata una risposta. Riprova, magari con un brief più corto.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Qualcosa è andato storto. Riprova.";
    if (message === STALE_JOB) return;
    if (message === JOB_STILL_RUNNING) {
      if (charged) refundBuildCredit(projectId, cost);
      charged = false;
      abandonVisualJob(projectId, RESUME_ERROR);
      return;
    }
    if (charged) refundBuildCredit(projectId, cost);
    abandonVisualJob(projectId, message);
  } finally {
    inflight.delete(projectId);
  }
}
