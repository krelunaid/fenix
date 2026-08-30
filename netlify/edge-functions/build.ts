declare const Netlify: { env: { get(name: string): string | undefined } };

import { QA_PROMPT, SYSTEM_PROMPT, VISUAL_PROMPT } from "../../src/lib/ai/prompts.shared.ts";

const MODEL = "grok-build-0.1";
const XAI_URL = "https://api.x.ai/v1/chat/completions";

type StreamEvent =
  | { t: "s"; s: string }
  | { t: "p"; n: number }
  | { t: "ok"; result: unknown }
  | { t: "err"; error: string };

type GrokChunk = {
  error?: { message?: string; error?: string } | string;
  choices?: {
    finish_reason?: string | null;
    delta?: { content?: unknown; reasoning_content?: unknown };
    message?: { content?: unknown; reasoning_content?: unknown };
  }[];
};

const DEFAULT_PALETTE = {
  bg: "#101114",
  surface: "#191b20",
  fg: "#f5f2ea",
  muted: "#a7a39a",
  accent: "#e1693f",
};

function sse(event: StreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const item = part as { text?: unknown; content?: unknown };
      if (typeof item.text === "string") return item.text;
      return typeof item.content === "string" ? item.content : "";
    })
    .join("");
}

function chunkParts(json: GrokChunk) {
  if (json.error) {
    const err = json.error;
    return {
      content: "",
      reasoning: "",
      error: typeof err === "string" ? err : err.message || err.error || "Errore dal modello.",
    };
  }
  const part = json.choices?.[0]?.delta ?? json.choices?.[0]?.message ?? {};
  return {
    content: textValue(part.content),
    reasoning: textValue(part.reasoning_content),
    error: "",
  };
}

function cleanText(value: unknown, fallback: string, max: number) {
  if (typeof value !== "string") return fallback;
  const text = value.replace(/\s+/g, " ").trim();
  return (text || fallback).slice(0, max);
}

function hex(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim()
    : fallback;
}

function parseResult(output: string) {
  const htmlMatch = output.match(/<!DOCTYPE html[\s\S]*?<\/html>/i) ?? output.match(/<html[\s\S]*?<\/html>/i);
  if (!htmlMatch) return null;
  const html = htmlMatch[0].startsWith("<!DOCTYPE") ? htmlMatch[0] : `<!DOCTYPE html>\n${htmlMatch[0]}`;
  if (html.length < 80) return null;

  const metaMatch = output.match(/<<<META>>>\s*([\s\S]*?)(?:<<<HTML>>>|$)/);
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(metaMatch?.[1]?.trim() || "{}") as Record<string, unknown>;
  } catch {
    meta = {};
  }
  const paletteIn = meta.palette && typeof meta.palette === "object"
    ? (meta.palette as Record<string, unknown>)
    : {};
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || "Studio";
  const kinds = ["landing", "app", "dashboard", "tool", "game", "site"];
  const kind = typeof meta.kind === "string" && kinds.includes(meta.kind) ? meta.kind : "site";

  return {
    name: cleanText(meta.name, title, 80),
    tagline: cleanText(meta.tagline, "", 120),
    kind,
    summary: cleanText(meta.summary, "", 280),
    direction: cleanText(meta.direction, "", 80),
    palette: {
      bg: hex(paletteIn.bg, DEFAULT_PALETTE.bg),
      surface: hex(paletteIn.surface, DEFAULT_PALETTE.surface),
      fg: hex(paletteIn.fg, DEFAULT_PALETTE.fg),
      muted: hex(paletteIn.muted, DEFAULT_PALETTE.muted),
      accent: hex(paletteIn.accent, DEFAULT_PALETTE.accent),
    },
    html,
    files: [{ path: "index.html", content: html }],
  };
}

function stage(output: string) {
  if (/<\/html>/i.test(output)) return "Apro l'anteprima";
  if (/<!DOCTYPE html|<<<HTML>>>/i.test(output)) return "Scrivo l'interfaccia";
  if (/<<<META>>>|\"direction\"\s*:|\"name\"\s*:/i.test(output)) return "Applico la direzione visiva";
  return output.trim().length > 8 ? "Compongo colori, icone, interfaccia" : null;
}

async function designDirection(apiKey: string, prompt: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22_000);
  try {
    const response = await fetch(XAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.9,
        max_tokens: 2500,
        stream: false,
        messages: [
          { role: "system", content: VISUAL_PROMPT },
          {
            role: "user",
            content: `BRIEF:\n${prompt}\n\nRestituisci un unico JSON di direzione visiva, senza markdown.`,
          },
        ],
      }),
    });
    if (!response.ok) return "";
    const json = (await response.json()) as GrokChunk;
    return textValue(json.choices?.[0]?.message?.content).trim().slice(0, 9000);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function reviewPass(apiKey: string, prompt: string, html: string, spec: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(XAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.55,
        max_tokens: 8000,
        stream: false,
        messages: [
          { role: "system", content: QA_PROMPT },
          {
            role: "user",
            content: `BRIEF:\n${prompt}\n\n${spec ? `DIREZIONE VISIVA:\n${spec}\n\n` : ""}HTML DA RIVEDERE:\n${html.slice(0, 35000)}\n\nRivedi la grafica, tieni le funzioni, META+HTML.`,
          },
        ],
      }),
    });
    if (!response.ok) return "";
    const json = (await response.json()) as GrokChunk;
    return textValue(json.choices?.[0]?.message?.content);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export default async function build(request: Request) {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const apiKey = Netlify.env.get("XAI_API_KEY")?.trim();
  if (!apiKey) {
    return Response.json({ t: "err", error: "Manca XAI_API_KEY sul server" }, { status: 503 });
  }

  let body: { prompt?: string; html?: string; instruction?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ t: "err", error: "Brief non valido." }, { status: 400 });
  }
  const prompt = (body.prompt ?? "").trim().slice(0, 2500);
  if (prompt.length < 3) {
    return Response.json({ t: "err", error: "Scrivi cosa vuoi costruire." }, { status: 400 });
  }
  const instruction = (body.instruction ?? "").trim().slice(0, 2500);
  const currentHtml = (body.html ?? "").slice(0, 90000);
  const userParts = [
    `BRIEF:\n${prompt}`,
    "Crea un prodotto completo, specifico e immediatamente utilizzabile.",
    instruction && currentHtml ? `APP ATTUALE:\n${currentHtml}` : "",
    instruction ? `MODIFICA:\n${instruction}\nRestituisci il documento completo.` : "",
    "Costruisci ora. Formato META + HTML, nient'altro.",
  ].filter(Boolean);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let terminal = false;
      let output = "";
      const send = (event: StreamEvent) => {
        if (!closed) controller.enqueue(encoder.encode(sse(event)));
      };
      const finish = (event: StreamEvent) => {
        if (terminal || closed) return;
        terminal = true;
        send(event);
      };
      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": ping\n\n"));
      }, 4000);

      try {
        let spec = "";
        if (!instruction) {
          send({ t: "s", s: "Direzione visiva" });
          spec = await designDirection(apiKey, prompt);
          if (spec) {
            userParts.splice(
              1,
              0,
              `DIREZIONE VISIVA (legge, non ispirazione — hex, font, icona, tab, foto):\n${spec}`,
            );
          }
        }
        send({ t: "s", s: "Penso il prodotto" });
        const response = await fetch(XAI_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: MODEL,
            temperature: instruction ? 0.5 : 0.8,
            max_tokens: 20000,
            stream: true,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userParts.join("\n\n") },
            ],
          }),
        });
        if (!response.ok || !response.body) {
          const detail = await response.text().catch(() => "");
          finish({ t: "err", error: `Il modello non ha risposto (${response.status}). ${detail.slice(0, 180)}`.trim() });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let lastStage = "Penso il prodotto";
        let progress = 0;
        const ingest = (payload: string) => {
          if (!payload || payload === "[DONE]") return;
          let json: GrokChunk;
          try {
            json = JSON.parse(payload) as GrokChunk;
          } catch {
            return;
          }
          const piece = chunkParts(json);
          if (piece.error) {
            finish({ t: "err", error: piece.error });
            return;
          }
          if (!piece.content) return;
          output += piece.content;
          const nextStage = stage(output);
          if (nextStage && nextStage !== lastStage) {
            lastStage = nextStage;
            send({ t: "s", s: nextStage });
          }
          if (output.length - progress >= 400) {
            progress = output.length;
            send({ t: "p", n: output.length });
          }
        };

        while (!terminal) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data:")) ingest(trimmed.slice(5).trim());
            if (terminal) break;
          }
        }
        const tail = `${buffer}${decoder.decode()}`.trim();
        for (const line of tail.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) ingest(trimmed.slice(5).trim());
        }
        if (!terminal) {
          let result = parseResult(output);
          if (result && !instruction) {
            send({ t: "s", s: "Provo la grafica" });
            const reviewed = await reviewPass(apiKey, prompt, result.html, spec);
            result = parseResult(reviewed) ?? result;
          }
          finish(result
            ? { t: "ok", result }
            : { t: "err", error: output.trim() ? "Risposta incompleta. Riprova." : "Grok Build non ha inviato il codice. Riprova." });
        }
      } catch (error) {
        const result = parseResult(output);
        finish(result
          ? { t: "ok", result }
          : { t: "err", error: error instanceof Error ? `Non riesco a raggiungere il modello (${error.message}).` : "Errore di rete. Riprova." });
      } finally {
        clearInterval(heartbeat);
        if (!terminal) finish({ t: "err", error: "Non è arrivata una risposta dal modello. Riprova." });
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export const config = {
  path: "/api/build",
  method: "POST",
};
