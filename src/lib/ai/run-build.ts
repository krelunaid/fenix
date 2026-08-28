import type { StreamEvent } from "./stages";
import { applyBuildResult, useProjectStore } from "@/lib/projects/store";
import { parseBuildOutput, type BuildResult } from "./parse";
import { uid } from "@/lib/utils";

const inflight = new Set<string>();

function readyCopy(result: BuildResult) {
  const summary = result.summary?.trim();
  return [
    `Pronto. ${result.name} è in anteprima e si usa.`,
    summary,
    "Dimmi cosa cambiare: comportamento, schermate, dati, tono.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function consumeStream(
  projectId: string,
  body: { prompt: string; html?: string; instruction?: string },
): Promise<boolean> {
  const store = useProjectStore.getState();
  const res = await fetch("/api/build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    let message = `La generazione non è partita (${res.status}).`;
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      /* keep the useful HTTP fallback */
    }
    store.updateProject(projectId, { status: "error", error: message });
    store.addMessage(projectId, { id: uid(), role: "assistant", content: message });
    return true;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  let partial = "";
  let terminalError = "";

  function applyEvent(event: StreamEvent) {
    if (event.t === "d") {
      partial += event.v;
    } else if (event.t === "s") {
      const current = useProjectStore.getState().getProject(projectId);
      const log = current?.buildLog ?? [];
      if (log[log.length - 1] !== event.s) {
        store.updateProject(projectId, { buildLog: [...log, event.s] });
      }
    } else if (event.t === "ok") {
      const result = event.result as BuildResult;
      applyBuildResult(projectId, result);
      store.addMessage(projectId, { id: uid(), role: "assistant", content: readyCopy(result) });
      finished = true;
    } else if (event.t === "err") {
      terminalError = event.error;
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        try {
          applyEvent(JSON.parse(line.slice(5).trim()) as StreamEvent);
        } catch {
          /* ignore malformed sse lines */
        }
      }
    }
  } catch {
    terminalError = "La connessione si è chiusa prima della risposta completa.";
  }

  const trailing = buffer.trim();
  if (trailing.startsWith("data:")) {
    try {
      const event = JSON.parse(trailing.slice(5).trim()) as StreamEvent;
      applyEvent(event);
    } catch {
      /* incomplete trailing event */
    }
  }

  if (!finished && partial) {
    const recovered = parseBuildOutput(partial, body.prompt);
    if (recovered) {
      applyBuildResult(projectId, recovered);
      store.addMessage(projectId, { id: uid(), role: "assistant", content: readyCopy(recovered) });
      return true;
    }
  }

  if (!finished && terminalError) {
    store.updateProject(projectId, { status: "error", error: terminalError });
    store.addMessage(projectId, { id: uid(), role: "assistant", content: terminalError });
    return true;
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

  store.updateProject(projectId, {
    status: "building",
    error: undefined,
    buildLog: [],
  });
  store.addMessage(projectId, {
    id: uid(),
    role: "assistant",
    content: instruction
      ? `Ok. Applico: ${instruction.slice(0, 140)}`
      : "Ok. Lo costruisco.",
  });

  try {
    const streamed = await consumeStream(projectId, {
      prompt: project.prompt,
      html: instruction ? project.html : undefined,
      instruction,
    });
    if (streamed) return;

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
    const message =
      err instanceof Error ? err.message : "Qualcosa è andato storto. Riprova.";
    store.updateProject(projectId, { status: "error", error: message });
    store.addMessage(projectId, { id: uid(), role: "assistant", content: message });
  } finally {
    inflight.delete(projectId);
  }
}
