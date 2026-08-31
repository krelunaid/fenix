import { createFileRoute } from "@tanstack/react-router";
import { parseBuildOutput } from "@/lib/ai/parse";
import { generateHeroUrl, injectHero, heroAspect } from "@/lib/ai/hero-image";
import { SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { looksCheap, reviewBuild } from "@/lib/ai/qa";
import { gateBuildResult } from "@/lib/ai/repair";
import { detectStage, sseLine } from "@/lib/ai/stages";
import { designVisual } from "@/lib/ai/visual";
import {
  getXaiApiKey,
  XAI_CHAT_COMPLETIONS_URL,
  XAI_MISSING_KEY_ERROR,
  FENIX_MODEL,
} from "@/lib/ai/model";
import { formatPrefix, kindFromPrompt } from "@/lib/projects/infer";

type Body = {
  prompt?: string;
  html?: string;
  instruction?: string;
  shot?: string;
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
        const apiKey = getXaiApiKey();
        if (!apiKey) {
          return Response.json(
            { t: "err", error: XAI_MISSING_KEY_ERROR },
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
        const shot =
          typeof body.shot === "string" && body.shot.startsWith("data:image")
            ? body.shot.slice(0, 380000)
            : "";

        const seed = Array.from(prompt).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
        const lockKind = kindFromPrompt(prompt) ?? "app";
        const userParts = [
          `BRIEF:\n${prompt}`,
          formatPrefix(lockKind).trim(),
        ];
        if (lockKind === "dashboard") {
          userParts.push(
            "COMPLETO: gestionale desktop con almeno 3 viste, tabella o elenco, form, filtri, numeri. Niente nav.fk-tab, niente tabbar iPhone.",
          );
        } else if (lockKind === "site" || lockKind === "landing") {
          userParts.push("COMPLETO: sito con sezioni, nav in alto, footer. NON un'app telefono.");
        } else {
          userParts.push(
            "COMPLETO: 5 schermate che si usano (home, nuovo, lista, numeri, altro). Form che salvano. Niente hero da homepage.",
          );
        }
        if (html && instruction) userParts.push(`APP ATTUALE (HTML):\n${html}`);
        if (instruction) {
          userParts.push(
            `MODIFICA:\n${instruction}\nApplica questa modifica, tieni identità e funzioni già ok, restituisci l'app completa.`,
          );
        }
        if (shot) {
          userParts.push(
            "SCREENSHOT allegato: VEDI l'anteprima. Correggi chrome, contrasto, tab, icone, form. Tieni il JS.",
          );
        }
        userParts.push("Costruisci ora. Formato META + HTML, nient'altro. Niente ragionamento nel documento.");

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            let closed = false;
            const enqueue = (chunk: string) => {
              if (closed) return false;
              try {
                controller.enqueue(encoder.encode(chunk));
                return true;
              } catch {
                closed = true;
                return false;
              }
            };
            const send = (event: Parameters<typeof sseLine>[0]) => {
              enqueue(sseLine(event));
            };
            const ping = () => {
              enqueue(": ping\n\n");
            };
            const abort = new AbortController();
            const timer = setTimeout(() => abort.abort(), 175_000);
            const heartbeat = setInterval(ping, 4000);
            let acc = "";
            let emitted = false;
            const finish = (event: Parameters<typeof sseLine>[0]) => {
              if (emitted || closed) return;
              emitted = true;
              send(event);
            };

            let visualSpec = "";
            try {
              send({ t: "s", s: "Direzione visiva" });
              if (!instruction) {
                const visCtl = new AbortController();
                const visTimer = setTimeout(() => visCtl.abort(), 22_000);
                try {
                  const spec = await designVisual({
                    apiKey,
                    prompt,
                    signal: visCtl.signal,
                  });
                  if (spec) {
                    visualSpec = spec;
                    userParts.splice(
                      1,
                      0,
                      `DIREZIONE VISIVA (legge, non ispirazione — hex, font, icona, tab, foto):\n${spec}`,
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
              const res = await fetch(XAI_CHAT_COMPLETIONS_URL, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
                },
                signal: abort.signal,
                body: JSON.stringify({
                  model: FENIX_MODEL,
                  temperature: instruction ? 0.5 : 0.85,
                  max_tokens: 20000,
                  stream: true,
                  messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    {
                      role: "user",
                      content: shot
                        ? [
                            { type: "text", text: userParts.join("\n\n") },
                            { type: "image_url", image_url: { url: shot } },
                          ]
                        : userParts.join("\n\n"),
                    },
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

              const parsed = parseBuildOutput(acc, lockKind);
              if (!parsed) {
                finish({
                  t: "err",
                  error: acc.trim()
                    ? "Risposta incompleta. Riprova, magari con un brief più stretto."
                    : "Grok Build ha ragionato ma non ha inviato il codice. Riprova.",
                });
              } else {
                let result = parsed;
                const shouldReview = !shot && (!instruction || looksCheap(parsed.html));
                if (shouldReview) {
                  send({ t: "s", s: "Provo la grafica" });
                  const visCtl = new AbortController();
                  const visTimer = setTimeout(() => visCtl.abort(), 50_000);
                  try {
                    const reviewed = await reviewBuild({
                      apiKey,
                      prompt,
                      html: parsed.html,
                      spec: visualSpec || undefined,
                      signal: visCtl.signal,
                    });
                    if (reviewed?.html && reviewed.html.length > 120) {
                      result = reviewed;
                    }
                  } catch {
                    /* keep first HTML */
                  } finally {
                    clearTimeout(visTimer);
                  }
                }
                send({ t: "s", s: "Foto del mestiere" });
                try {
                  const imgCtl = new AbortController();
                  const imgTimer = setTimeout(() => imgCtl.abort(), 25_000);
                  const hero = await generateHeroUrl(
                    apiKey,
                    prompt,
                    imgCtl.signal,
                    heroAspect(result.html),
                  );
                  clearTimeout(imgTimer);
                  if (hero) {
                    result = { ...result, html: injectHero(result.html, hero) };
                  }
                } catch {
                  /* senza foto, l'app resta */
                }
                const gated = await gateBuildResult({
                  apiKey,
                  prompt,
                  result,
                  signal: abort.signal,
                  onStage: (s) => send({ t: "s", s }),
                });
                if ("error" in gated) {
                  if (gated.result) finish({ t: "err", error: gated.error, result: gated.result });
                  else finish({ t: "err", error: gated.error });
                } else {
                  send({ t: "s", s: "Apro l'anteprima" });
                  finish({ t: "ok", result: gated.result });
                }
              }
            } catch (err) {
              const aborted = err instanceof Error && err.name === "AbortError";
              const salvage = parseBuildOutput(acc, lockKind);
              if (salvage) {
                const gated = await gateBuildResult({
                  apiKey,
                  prompt,
                  result: salvage,
                  signal: abort.signal,
                  onStage: (s) => send({ t: "s", s }),
                });
                if ("error" in gated) {
                  if (gated.result) finish({ t: "err", error: gated.error, result: gated.result });
                  else finish({ t: "err", error: gated.error });
                } else {
                  send({ t: "s", s: "Apro l'anteprima" });
                  finish({ t: "ok", result: gated.result });
                }
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
                const salvage = parseBuildOutput(acc, lockKind);
                if (salvage) {
                  const gated = await gateBuildResult({
                    apiKey,
                    prompt,
                    result: salvage,
                    onStage: (s) => send({ t: "s", s }),
                  });
                  if ("error" in gated) {
                    if (gated.result) finish({ t: "err", error: gated.error, result: gated.result });
                    else finish({ t: "err", error: gated.error });
                  } else finish({ t: "ok", result: gated.result });
                } else {
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
