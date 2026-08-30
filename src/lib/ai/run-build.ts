import type { StreamEvent } from "./stages";
import { applyBuildResult, useProjectStore } from "@/lib/projects/store";
import { parseBuildOutput, type BuildResult } from "./parse";
import { isWeakPreview, lookInstruction, resetAudit, waitPreviewAudit, waitPreviewShot } from "./look";
import { uid } from "@/lib/utils";

const inflight = new Set<string>();

function readyCopy(result: BuildResult) {
  const summary = result.summary?.trim();
  return [
    `Pronto. ${result.name} è in anteprima: ${result.files?.length || 1} file, si usa.`,
    summary,
    "Dimmi cosa cambiare: comportamento, schermate, dati, tono.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const WORKER_POLISH =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: { VITE_VISUAL_WORKER_URL?: string } }).env?.VITE_VISUAL_WORKER_URL?.replace(/\/$/, "")) ||
  "https://fenix-production-d9f5.up.railway.app";

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
        applyBuildResult(projectId, result);
        if (!quiet) {
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

  if (!store.spendCredit()) {
    store.updateProject(projectId, {
      status: "error",
      error: "Crediti esauriti. Il tetto di questa sessione è finito.",
    });
    store.addMessage(projectId, {
      id: uid(),
      role: "assistant",
      content: "Crediti esauriti. Ogni creazione o modifica ne usa uno. Il tetto di questa sessione è finito.",
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
      : "Ok. Lo costruisco.",
  });

  let charged = true;
  try {
    const streamed = await consumeStream(
      projectId,
      {
        prompt: project.prompt,
        html: instruction ? project.html : undefined,
        instruction,
      },
      true,
    );
    if (streamed) {
      const latest = useProjectStore.getState().getProject(projectId);
      if (latest?.status === "error") {
        store.refundCredit();
        charged = false;
        return;
      }
      if (latest?.html) {
        store.updateProject(projectId, {
          status: "building",
          buildLog: [
            ...(latest.buildLog ?? []),
            instruction ? "Motore visivo (modifica)" : "Motore visivo",
          ],
        });
        store.addMessage(projectId, {
          id: uid(),
          role: "assistant",
          content: instruction
            ? "Bozza aggiornata. Avvio il motore visivo (icone + 3 giri iOS)…"
            : "Bozza pronta. Avvio il motore visivo (icone + 3 giri iOS)…",
        });
        let polished = false;
        try {
          const payload = JSON.stringify({
            prompt: project.prompt,
            html: latest.html,
            instruction: instruction || undefined,
          });
          const ctrl = new AbortController();
          const timer = window.setTimeout(() => ctrl.abort(), 240_000);
          let res: Response | null = null;
          for (const url of [`${WORKER_POLISH}/polish`, "/api/polish"]) {
            try {
              res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload,
                signal: ctrl.signal,
              });
              if (res.status === 204) {
                res = null;
                continue;
              }
              if (res.ok) break;
            } catch {
              res = null;
            }
          }
          window.clearTimeout(timer);
          if (res?.ok) {
            const data = (await res.json()) as {
              result?: BuildResult;
              html?: string;
              meta?: Record<string, unknown>;
              log?: string[];
            };
            const result =
              data.result ??
              parseBuildOutput(
                `<<<META>>>\n${JSON.stringify(data.meta ?? {})}\n<<<HTML>>>\n${data.html ?? ""}\n<<<END>>>`,
              );
            if (result?.html) {
              applyBuildResult(projectId, result);
              const logs = data.log ?? [];
              store.updateProject(projectId, {
                status: "ready",
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
                  `Motore visivo: ${logs.length ? logs.join(" · ") : "3 giri iOS"}.`,
                  readyCopy(result),
                ].join("\n\n"),
              });
              polished = true;
            }
          }
        } catch {
          /* fallback sguardi in pagina */
        }
        if (polished) return;
        store.addMessage(projectId, {
          id: uid(),
          role: "assistant",
          content: "Motore visivo non ha risposto. Uso gli sguardi in pagina.",
        });
        if (instruction) {
          store.updateProject(projectId, { status: "ready" });
          const now = useProjectStore.getState().getProject(projectId);
          if (now) {
            store.addMessage(projectId, {
              id: uid(),
              role: "assistant",
              content: readyCopy({
                name: now.name,
                tagline: now.tagline,
                kind: now.kind,
                summary: now.summary,
                direction: now.direction,
                palette: now.palette,
                html: now.html,
                files: now.files,
              }),
            });
          }
          return;
        }

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
          if (after?.status === "error") {
            store.updateProject(projectId, {
              status: "ready",
              error: undefined,
              html: snapshot,
            });
            return false;
          }
          resetAudit();
          return true;
        };

        await look("Guardo i pixel");
        await new Promise((r) => window.setTimeout(r, 800));
        const second = await waitPreviewAudit(1800);
        if (isWeakPreview(second)) {
          await look("Secondo sguardo");
        }
        const done = useProjectStore.getState().getProject(projectId);
        if (done && done.status !== "error") {
          store.updateProject(projectId, { status: "ready" });
        }
      }
      return;
    }

    store.refundCredit();
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
    if (charged) store.refundCredit();
    const message =
      err instanceof Error ? err.message : "Qualcosa è andato storto. Riprova.";
    store.updateProject(projectId, { status: "error", error: message });
    store.addMessage(projectId, { id: uid(), role: "assistant", content: message });
  } finally {
    inflight.delete(projectId);
  }
}
