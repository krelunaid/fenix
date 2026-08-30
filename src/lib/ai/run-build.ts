import type { StreamEvent } from "./stages";
import { applyBuildResult, promoteReady, useProjectStore } from "@/lib/projects/store";
import { parseBuildOutput, type BuildResult } from "./parse";
import { isWeakPreview, lookInstruction, resetAudit, waitPreviewAudit, waitPreviewShot } from "./look";
import { APP_SHELL_HTML, APP_SHELL_INSTRUCTION } from "./app-shell";
import { CREATE_COST, ITERATE_COST } from "@/lib/projects/credits";
import { formatHtmlErrors, validateProductHtml } from "@/lib/projects/validate-html";
import { uid } from "@/lib/utils";

const inflight = new Set<string>();

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

async function callWorker(prompt: string, html: string, instruction?: string) {
  const attempts: { polish: string; job: (id: string) => string }[] = [
    { polish: "/__worker/polish", job: (id) => `/__worker/jobs/${id}` },
    {
      polish: `${WORKER_POLISH.replace(/\/$/, "")}/polish`,
      job: (id) => `${WORKER_POLISH.replace(/\/$/, "")}/jobs/${id}`,
    },
    { polish: "/api/polish", job: (id) => `/api/jobs/${id}` },
  ];
  let lastErr = "Load failed";
  const body = JSON.stringify({ prompt, html, instruction: instruction || undefined });
  for (const a of attempts) {
    try {
      const started = await fetch(a.polish, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (started.status === 202) {
        const { id } = (await started.json()) as { id?: string };
        if (!id) continue;
        for (let i = 0; i < 240; i++) {
          await new Promise((r) => window.setTimeout(r, 2000));
          const jobRes = await fetch(a.job(id));
          if (!jobRes.ok) continue;
          const job = (await jobRes.json()) as {
            status?: string;
            html?: string;
            meta?: Record<string, unknown>;
            log?: string[];
            files?: { path: string; content: string }[];
            error?: string;
          };
          if (job.status === "ok" && job.html) return job;
          if (job.status === "err") throw new Error(job.error || "Worker visivo fallito");
        }
        throw new Error("Motore visivo in coda troppo a lungo");
      }
      if (!started.ok) {
        lastErr = `Worker HTTP ${started.status}`;
        continue;
      }
      return (await started.json()) as {
        html?: string;
        meta?: Record<string, unknown>;
        log?: string[];
        files?: { path: string; content: string }[];
      };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "Load failed";
    }
  }
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
        body: JSON.stringify(body),
      });
      if (started.status !== 202) {
        lastErr = `Build HTTP ${started.status}`;
        continue;
      }
      const { id } = (await started.json()) as { id?: string };
      if (!id) continue;
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => window.setTimeout(r, 2000));
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
          const result = parseBuildOutput(
            `<<<META>>>\n${JSON.stringify(job.meta ?? {})}\n<<<HTML>>>\n${job.html}\n<<<END>>>`,
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
    const payload = {
      prompt: project.prompt,
      html: instruction ? project.html : APP_SHELL_HTML,
      instruction: instruction || APP_SHELL_INSTRUCTION,
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
        let lastValidHtml = latest.html;
        try {
          const data = await callWorker(project.prompt, latest.html, instruction);
          const fileBlocks = (data?.files ?? [])
            .map((f) => `<<<FILE path="${f.path}">>>\n${f.content}`)
            .join("\n");
          const result =
            data &&
            parseBuildOutput(
              `<<<META>>>\n${JSON.stringify(data.meta ?? {})}\n${fileBlocks}\n<<<HTML>>>\n${data.html ?? ""}\n<<<END>>>`,
            );
          if (result?.html) {
            const report = applyBuildResult(projectId, result, "building");
            if (report.syntaxOk) {
              lastValidHtml = result.html;
              const logs = data?.log ?? [];
              store.updateProject(projectId, {
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
              store.updateProject(projectId, { html: lastValidHtml, status: "building" });
              store.addMessage(projectId, {
                id: uid(),
                role: "assistant",
                content: `Rifinitura scartata (JS non valido). Resta la bozza valida. ${formatHtmlErrors(report)}`,
              });
            }
          }
        } catch (err) {
          const workerError = err instanceof Error ? err.message : "errore";
          store.addMessage(projectId, {
            id: uid(),
            role: "assistant",
            content: `Motore visivo non ha risposto (${workerError}). Uso gli sguardi in pagina.`,
          });
        }

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

        const promoted = promoteReady(projectId);
        if (promoted.ok) {
          store.addMessage(projectId, {
            id: uid(),
            role: "assistant",
            content: "Pronto. Anteprima e Pubblica sono attive.",
          });
          return;
        }
        store.refundCredit(cost);
        charged = false;
        store.updateProject(projectId, {
          status: "error",
          error: formatHtmlErrors(promoted) || "Prodotto incompleto",
        });
        store.addMessage(projectId, {
          id: uid(),
          role: "assistant",
          content: `Non pubblico: ${formatHtmlErrors(promoted)}. Credito rimborsato.`,
        });
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
