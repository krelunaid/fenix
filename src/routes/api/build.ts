import { createFileRoute } from "@tanstack/react-router";
import { FENIX_MODEL } from "@/lib/ai/model";
import { parseBuildOutput } from "@/lib/ai/parse";
import { SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { detectStage, sseLine } from "@/lib/ai/stages";
import { designVisual } from "@/lib/ai/visual";

type Body = {
  prompt?: string;
  html?: string;
  instruction?: string;
};

type GrokChunk = {
  error?: { message?: string; error?: string } | string;
  choices?: {
    finish_reason?: string | null;
    delta?: {
      content?: unknown;
      reasoning_content?: unknown;
    };
    message?: {
      content?: unknown;
      reasoning_content?: unknown;
    };
  }[];
};

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const rec = part as { text?: unknown; content?: unknown };
          if (typeof rec.text === "string") return rec.text;
          if (typeof rec.content === "string") return rec.content;
        }
        return "";
      })
      .join("");
  }
  return "";
}

function grokDelta(json: GrokChunk) {
  if (json.error) {
    const err = json.error;
    const message =
      typeof err === "string"
        ? err
        : err.message || err.error || "Errore dal modello.";
    return { content: "", reasoning: "", finish: null as string | null, error: message };
  }
  const choice = json.choices?.[0];
  const part = choice?.delta ?? choice?.message ?? {};
  return {
    content: asText(part.content),
    reasoning: asText(part.reasoning_content),
    finish: choice?.finish_reason ?? null,
    error: null as string | null,
  };
}

export const Route = createFileRoute("/api/build")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Server-only. Never VITE_XAI_API_KEY — that would leak to the browser.
        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) {
          return Response.json(
            { t: "err", error: "Fenix non è disponibile in questo ambiente." },
            { status: 503 },
          );
        }

        let body: Body = {};
        try {
          body = (await request.json()) as Body;
        } catch {
          return Response.json({ t: "err", error: "Brief non valido." }, { status: 400 });
        }

        const prompt = (body.prompt ?? "").trim().slice(0, 2500);
        if (prompt.length < 3) {
          return Response.json({ t: "err", error: "Scrivi cosa vuoi costruire." }, { status: 400 });
        }

        const instruction = (body.instruction ?? "").trim().slice(0, 2500);
        const html = (body.html ?? "").slice(0, 90000);

        const seed = Array.from(prompt).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
        const userParts = [
          `BRIEF:\n${prompt}`,
          `VINCOLO UNICITÀ: seed ${Math.abs(seed).toString(16)}. Questo prodotto NON deve assomigliare agli altri. Palette, font, layout e foto nati dal brief. Vietato #f5f5f7 + Manrope + hero centrato.`,
          `COMPLETO: app/tool/gioco = 3+ viste funzionanti. Sito = 4+ sezioni, nav, form, testi veri.`,
        ];
        if (html && instruction) userParts.push(`APP ATTUALE (HTML):\n${html}`);
        if (instruction) {
          userParts.push(
            `MODIFICA:\n${instruction}\nApplica questa modifica, tieni identità e funzioni già ok, restituisci l'app completa.`,
          );
        }
        userParts.push("Costruisci ora. Formato META + HTML, nient'altro. Niente ragionamento nel documento.");

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            let closed = false;
            const send = (event: Parameters<typeof sseLine>[0]) => {
              if (closed) return;
              controller.enqueue(encoder.encode(sseLine(event)));
            };
            const ping = () => {
              if (closed) return;
              controller.enqueue(encoder.encode(": ping\n\n"));
            };
            const abort = new AbortController();
            const timer = setTimeout(() => abort.abort(), 140_000);
            const heartbeat = setInterval(ping, 4000);
            let acc = "";
            let emitted = false;
            const finish = (event: Parameters<typeof sseLine>[0]) => {
              if (emitted || closed) return;
              emitted = true;
              send(event);
            };

            try {
              send({ t: "s", s: "Direzione visiva" });
              if (!instruction) {
                const visCtl = new AbortController();
                const visTimer = setTimeout(() => visCtl.abort(), 14_000);
                try {
                  const spec = await designVisual({
                    apiKey,
                    prompt,
                    signal: visCtl.signal,
                  });
                  if (spec) {
                    userParts.splice(
                      1,
                      0,
                      `DIREZIONE VISIVA (agente visivo — obbedisci):\n${spec}`,
                    );
                  }
                } catch {
                  /* build anyway */
                } finally {
                  clearTimeout(visTimer);
                }
              }

              send({ t: "s", s: "Compongo colori, icone, interfaccia" });
              // Chat Completions: grok-build-0.1 streams reasoning_content first, then content.
              // temperature e max_tokens sono supportati. Non usare reasoning_effort.
              const res = await fetch("https://api.x.ai/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
                },
                signal: abort.signal,
                body: JSON.stringify({
                  model: FENIX_MODEL,
                  temperature: instruction ? 0.5 : 0.85,
                  max_tokens: 16000,
                  stream: true,
                  messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: userParts.join("\n\n") },
                  ],
                }),
              });

              if (!res.ok || !res.body) {
                const text = await res.text().catch(() => "");
                const msg =
                  res.status === 429
                    ? "Troppe richieste. Attendi un momento e riprova."
                    : `Il modello non ha risposto (${res.status}). ${text.slice(0, 160)}`.trim();
                finish({ t: "err", error: msg });
                return;
              }

              const reader = res.body.getReader();
              const decoder = new TextDecoder();
              let buffer = "";
              let lastStage = "Compongo colori, icone, interfaccia";
              let lastProgress = 0;
              let sawReasoning = false;

              const ingest = (payload: string) => {
                if (!payload || payload === "[DONE]") return;
                let json: GrokChunk;
                try {
                  json = JSON.parse(payload) as GrokChunk;
                } catch {
                  return;
                }
                const piece = grokDelta(json);
                if (piece.error) {
                  finish({ t: "err", error: piece.error });
                  return;
                }
                if (piece.reasoning && !sawReasoning) {
                  sawReasoning = true;
                  if (lastStage !== "Penso il prodotto") {
                    lastStage = "Penso il prodotto";
                    send({ t: "s", s: lastStage });
                  }
                }
                if (!piece.content) return;
                acc += piece.content;
                const stage = detectStage(acc);
                if (stage && stage !== lastStage) {
                  lastStage = stage;
                  send({ t: "s", s: stage });
                }
                if (acc.length - lastProgress >= 400) {
                  lastProgress = acc.length;
                  send({ t: "p", n: acc.length });
                }
              };

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const chunks = buffer.split("\n");
                buffer = chunks.pop() ?? "";
                for (const line of chunks) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  ingest(trimmed.slice(5).trim());
                  if (emitted) break;
                }
                if (emitted) break;
              }
              const tail = (buffer + decoder.decode()).trim();
              if (tail.startsWith("data:")) ingest(tail.slice(5).trim());

              if (emitted) return;

              const parsed = parseBuildOutput(acc);
              if (!parsed) {
                finish({
                  t: "err",
                  error: acc.trim()
                    ? "Risposta incompleta. Riprova, magari con un brief più stretto."
                    : "Grok Build ha ragionato ma non ha inviato il codice. Riprova.",
                });
              } else {
                send({ t: "s", s: "Apro l'anteprima" });
                finish({ t: "ok", result: parsed });
              }
            } catch (err) {
              const aborted = err instanceof Error && err.name === "AbortError";
              const salvage = parseBuildOutput(acc);
              if (salvage) {
                send({ t: "s", s: "Apro l'anteprima" });
                finish({ t: "ok", result: salvage });
              } else {
                finish({
                  t: "err",
                  error: aborted
                    ? "Ci ho messo troppo. Accorcia il brief e riprova."
                    : err instanceof Error
                      ? `Non riesco a raggiungere il modello (${err.message}).`
                      : "Errore di rete. Riprova.",
                });
              }
            } finally {
              clearInterval(heartbeat);
              clearTimeout(timer);
              if (!emitted) {
                const salvage = parseBuildOutput(acc);
                if (salvage) finish({ t: "ok", result: salvage });
                else {
                  finish({
                    t: "err",
                    error: "Non è arrivata una risposta dal modello. Riprova.",
                  });
                }
              }
              closed = true;
              try {
                controller.close();
              } catch {
                /* already closed */
              }
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
