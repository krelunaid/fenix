import type { StreamEvent } from "./stages";
import {
  applyBuildResult,
  promoteReady,
  RESUME_ERROR,
  useProjectStore,
} from "@/lib/projects/store";
import { parseBuildOutput, type BuildResult } from "./parse";
import { isWeakPreview, lookInstruction, resetAudit, waitPreviewAudit, waitPreviewShot } from "./look";
import { APP_SHELL_HTML, APP_SHELL_INSTRUCTION, DASHBOARD_POLISH_INSTRUCTION } from "./app-shell";
import { CREATE_COST, ITERATE_COST } from "@/lib/projects/credits";
import { isPhoneKind, resolveProjectKind } from "@/lib/projects/infer";
import { formatHtmlErrors, validateProductHtml } from "@/lib/projects/validate-html";
import {
  clearVisualJobPatch,
  hasActiveVisualJob,
  JOB_STILL_RUNNING,
  VISUAL_JOB_TTL_MS,
  visualJobPatch,
} from "@/lib/projects/visual-job";
import { uid } from "@/lib/utils";

const inflight = new Set<string>();

export const WORKER_POLL_MAX = 30;
const WORKER_POLL_MS = 2000;
/** 2s ticks while a persisted job is live. Overlay stays compact. */
export const WORKER_JOB_POLL_MAX = 180;
const GENERATE_POLL_MAX = 90;

function readyCopy(result: BuildResult) {
  const summary = result.summary?.trim();
  return [
    `Pronto. ${result.name} è in anteprima: ${result.files?.filter((f) => f.path.startsWith("screens/")).length || 1} schermate (Fenix 2: Vite + React).`,
    summary,
    "Tocca un suggerimento sotto, o scrivi cosa cambiare.",
  ]
    .filter(Boolean)
    .join("\n\n");
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

async function fetchJob(id: string): Promise<WorkerJob | null> {
  for (const url of jobUrls(id)) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      return (await r.json()) as WorkerJob;
    } catch {
      /* next endpoint */
    }
  }
  return null;
}

async function pollWorkerJob(projectId: string, jobId: string): Promise<WorkerJob> {
  const store = useProjectStore.getState();
  const existing = store.getProject(projectId);
  const started = existing?.visualJobStartedAt ?? Date.now();
  store.updateProject(projectId, {
    ...visualJobPatch(jobId, "run", started),
    status: "building",
    error: undefined,
  });
  const deadline = started + VISUAL_JOB_TTL_MS;
  let ticks = 0;
  let misses = 0;
  while (Date.now() < deadline) {
    await delay(WORKER_POLL_MS);
    ticks += 1;
    const job = await fetchJob(jobId);
    if (!job) {
      misses += 1;
      if (misses >= 8) throw new Error("Job visivo non trovato. Tocca Riprendi rifinitura.");
      continue;
    }
    misses = 0;
    if (Array.isArray(job.log) && job.log.length) {
      const current = store.getProject(projectId);
      const prev = current?.buildLog ?? [];
      const last = job.log[job.log.length - 1];
      if (last && prev[prev.length - 1] !== last) {
        store.updateProject(projectId, { buildLog: [...prev, last] });
      }
    }
    if (job.status === "ok" && job.html) {
      return job;
    }
    if (job.status === "err") {
      throw new Error(`${job.error || "Worker visivo fallito"}. Tocca Riprendi rifinitura.`);
    }
    if (ticks >= WORKER_JOB_POLL_MAX) throw new Error(JOB_STILL_RUNNING);
    if (ticks === WORKER_POLL_MAX) {
      const current = store.getProject(projectId);
      store.updateProject(projectId, {
        buildLog: [...(current?.buildLog ?? []), "Motore visivo ancora in corso"],
      });
    }
  }
  throw new Error("Tempo scaduto sul motore visivo. Tocca Riprendi rifinitura.");
}

async function startPolishJob(
  projectId: string,
  prompt: string,
  html: string,
  instruction?: string,
): Promise<WorkerJob> {
  const store = useProjectStore.getState();
  const project = store.getProject(projectId);
  if (project && hasActiveVisualJob(project) && project.visualJobId) {
    return pollWorkerJob(projectId, project.visualJobId);
  }

  const body = JSON.stringify({
    prompt,
    html,
    instruction: instruction || undefined,
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
  if (jobId) return pollWorkerJob(projectId, jobId);
  throw new Error(lastErr);
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iP(hone|od|ad)/.test(navigator.userAgent);
}

async function consumeViaWorker(
  projectId: string,
  body: { prompt: string; html?: string; instruction?: string },
  quiet = false,
): Promise<boolean> {
  const store = useProjectStore.getState();
  const bases = ["/__worker", WORKER_POLISH.replace(/\/$/, "")];
  let lastErr = "Load failed";
  for (const base of bases) {
    try {
      const started = await fetch(`${base}/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, projectId }),
      });
      if (started.status !== 202) {
        lastErr = `Build HTTP ${started.status}`;
        continue;
      }
      const { id } = (await started.json()) as { id?: string };
      if (!id) continue;
      for (let i = 0; i < GENERATE_POLL_MAX; i++) {
        await new Promise((r) => window.setTimeout(r, WORKER_POLL_MS));
        const jobRes = await fetch(`${base}/jobs/${id}`);
        if (!jobRes.ok) continue;
        const job = (await jobRes.json()) as {
          status?: string;
          html?: string;
          meta?: Record<string, unknown>;
          log?: string[];
          error?: string;
        };
        if (job.status === "ok" && job.html) {
          const current = useProjectStore.getState().getProject(projectId);
          const lockKind = resolveProjectKind({
            stored: current?.kind,
            requested: current?.requestedKind,
            prompt: current?.prompt ?? body.prompt,
          });
          const result = parseBuildOutput(
            `<<<META>>>\n${JSON.stringify(job.meta ?? {})}\n<<<HTML>>>\n${job.html}\n<<<END>>>`,
            lockKind,
          );
          if (!result) throw new Error("Risposta non valida");
          const report = applyBuildResult(projectId, result, "building");
          if (!report.syntaxOk) throw new Error(formatHtmlErrors(report) || "HTML non valido");
          if (!quiet) {
            store.addMessage(projectId, {
              id: uid(),
              role: "assistant",
              content: readyCopy(result),
            });
          }
          return true;
        }
        if (job.status === "err") throw new Error(job.error || "Build fallita");
      }
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "Load failed";
    }
  }
  throw new Error(lastErr);
}

async function consumeStream(
  projectId: string,
  body: { prompt: string; html?: string; instruction?: string; shot?: string },
  quiet = false,
): Promise<boolean> {
  const store = useProjectStore.getState();
  const res = await fetch("/api/build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
        const current = useProjectStore.getState().getProject(projectId);
        const log = current?.buildLog ?? [];
        if (log[log.length - 1] !== event.s) {
          store.updateProject(projectId, { buildLog: [...log, event.s] });
        }
      } else if (event.t === "ok") {
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
            content: readyCopy(result),
          });
        }
        finished = true;
      } else if (event.t === "err") {
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

  return finished;
}

async function polishDraft(
  projectId: string,
  prompt: string,
  html: string,
  instruction?: string,
) {
  const store = useProjectStore.getState();
  let lastValidHtml = html;
  try {
    const data = await startPolishJob(projectId, prompt, html, instruction);
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
      );
    if (result?.html) {
      const report = applyBuildResult(projectId, result, "building");
      if (report.syntaxOk) {
        lastValidHtml = result.html;
        const logs = data?.log ?? [];
        store.updateProject(projectId, {
          ...clearVisualJobPatch(),
          buildLog: [
            ...(useProjectStore.getState().getProject(projectId)?.buildLog ?? []),
            ...logs,
            "Anteprima rifinita",
          ],
        });
        store.addMessage(projectId, {
          id: uid(),
          role: "assistant",
          content: [
            `Motore visivo: ${logs.length ? logs.join(" · ") : "icone e rifinitura"}.`,
            readyCopy(result),
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
    if (workerError === JOB_STILL_RUNNING || /Riprendi rifinitura/i.test(workerError)) {
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

function finishPolish(projectId: string, lastValidHtml: string, refund?: number) {
  const store = useProjectStore.getState();
  const promoted = promoteReady(projectId);
  if (promoted.ok) {
    store.updateProject(projectId, { ...clearVisualJobPatch(), status: "ready", error: undefined });
    store.addMessage(projectId, {
      id: uid(),
      role: "assistant",
      content: "Pronto. Anteprima e Pubblica sono attive.",
    });
    return true;
  }
  if (refund) store.refundCredit(refund);
  store.updateProject(projectId, {
    html: lastValidHtml,
    status: "error",
    error: RESUME_ERROR,
    ...clearVisualJobPatch(),
  });
  store.addMessage(projectId, {
    id: uid(),
    role: "assistant",
    content: refund
      ? `Non pubblico: ${formatHtmlErrors(promoted)}. Credito rimborsato. ${RESUME_ERROR}`
      : RESUME_ERROR,
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
  const kind = resolveProjectKind({
    stored: project.kind,
    requested: project.requestedKind,
    prompt: project.prompt,
  });
  store.updateProject(projectId, {
    kind,
    requestedKind: project.requestedKind ?? kind,
    status: "building",
    error: undefined,
    buildLog: [...(project.buildLog ?? []), "Riprendo rifinitura"],
  });
  try {
    const phoneShell = /\bfk-tab\b/.test(project.html);
    const instruction =
      kind === "dashboard" && phoneShell ? DASHBOARD_POLISH_INSTRUCTION : undefined;
    const lastValidHtml = await polishDraft(projectId, project.prompt, project.html, instruction);
    const latest = useProjectStore.getState().getProject(projectId);
    if (hasActiveVisualJob(latest ?? {})) return;
    finishPolish(projectId, lastValidHtml);
  } catch (err) {
    const message = err instanceof Error ? err.message : RESUME_ERROR;
    if (message === JOB_STILL_RUNNING) return;
    const storeNow = useProjectStore.getState();
    storeNow.updateProject(projectId, {
      status: "error",
      error: /riprendi/i.test(message) ? message : `${message}. ${RESUME_ERROR}`,
      ...clearVisualJobPatch(),
    });
    storeNow.addMessage(projectId, { id: uid(), role: "assistant", content: message });
  } finally {
    inflight.delete(projectId);
  }
}

export async function runBuild(projectId: string, instruction?: string) {
  if (inflight.has(projectId)) return;
  inflight.add(projectId);

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

  store.updateProject(projectId, {
    status: "building",
    error: undefined,
    buildLog: [],
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
    const payload = {
      prompt: project.prompt,
      html: instruction ? project.html : phone ? APP_SHELL_HTML : project.html || "",
      instruction:
        instruction ||
        (kind === "dashboard"
          ? DASHBOARD_POLISH_INSTRUCTION
          : phone
            ? APP_SHELL_INSTRUCTION
            : undefined),
    };
    try {
      streamed = isIOS()
        ? await consumeViaWorker(projectId, payload, true)
        : await consumeStream(projectId, payload, true);
    } catch (first) {
      const msg = first instanceof Error ? first.message : "";
      if (/load failed|failed to fetch/i.test(msg)) {
        streamed = await consumeViaWorker(projectId, payload, true);
      } else {
        throw first;
      }
    }
    if (streamed) {
      const latest = useProjectStore.getState().getProject(projectId);
      if (latest?.status === "error") {
        store.refundCredit(cost);
        charged = false;
        return;
      }
      if (latest?.html) {
        const draftCheck = validateProductHtml(latest.html, { kind: latest.kind });
        if (!draftCheck.syntaxOk) {
          store.refundCredit(cost);
          charged = false;
          store.updateProject(projectId, {
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
        store.updateProject(projectId, {
          status: "building",
          buildLog: [...(latest.buildLog ?? []), "Motore visivo in sottofondo"],
        });
        store.addMessage(projectId, {
          id: uid(),
          role: "assistant",
          content: instruction
            ? "Bozza valida in anteprima. Il motore visivo rifinisce (icone, 5–10 min). Pubblica resta chiusa finché non è pronto."
            : "Bozza valida in anteprima. Il motore visivo rifinisce in sottofondo. Pubblica resta chiusa finché non è pronto.",
        });
        let lastValidHtml = await polishDraft(projectId, project.prompt, latest.html, instruction);

        if (!(instruction || isIOS())) {
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

        charged = !finishPolish(projectId, lastValidHtml, cost);
        return;
      }
      return;
    }

    store.refundCredit(cost);
    charged = false;
    store.updateProject(projectId, {
      status: "error",
      error: "Non è arrivata una risposta. Riprova.",
    });
    store.addMessage(projectId, {
      id: uid(),
      role: "assistant",
      content: "Non è arrivata una risposta. Riprova, magari con un brief più corto.",
    });
  } catch (err) {
    if (charged) store.refundCredit(cost);
    const message =
      err instanceof Error ? err.message : "Qualcosa è andato storto. Riprova.";
    store.updateProject(projectId, { status: "error", error: message });
    store.addMessage(projectId, { id: uid(), role: "assistant", content: message });
  } finally {
    inflight.delete(projectId);
  }
}
