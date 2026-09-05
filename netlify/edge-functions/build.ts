declare const Netlify: { env: { get(name: string): string | undefined } };

import { QA_PROMPT, REPAIR_PROMPT, SITE_PROMPT, SYSTEM_PROMPT, VISUAL_PROMPT } from "../../src/lib/ai/prompts.shared.ts";
import { formatPrefix, isPhoneKind, kindFromPrompt } from "../../src/lib/projects/infer.ts";
import { ingestProjectFiles, parseProjectFiles } from "../../src/lib/projects/files.ts";
import {
  CONTRACT_REPAIR_MAX,
  contractInstruction,
  criticBudget,
  evaluateContract,
  formatReceipt,
  planContract,
  roleReceipt,
} from "../../src/lib/ai/build-contract.ts";
import { gateIncompleteHtml, type GatedProduct } from "../../src/lib/projects/fenix-adapter.ts";
import { fallbackPaletteFromBrief, tokensFromBrief, tokensInstruction } from "../../src/lib/projects/design-tokens.ts";
import { grammarFromBrief, grammarInstruction } from "../../src/lib/projects/layout-grammar.ts";
import { sanitizePaletteHistory, type PaletteRecord } from "../../src/lib/projects/palette-engine.ts";
import { artifactContext, MAX_ARTIFACT_CHARS } from "../../workers/visual/artifact-context.mjs";
import type { ProjectKind } from "../../src/lib/projects/types.ts";
import { enforceGraphicIntent } from "../../src/lib/projects/graphic-intent.ts";
import { repairFilesContext } from "../../src/lib/ai/repair-context.ts";
import { isComposedVisualArtifact } from "../../workers/visual/visual-style.mjs";
import { applyComposedBuildPlanWeb, composedBaseShaWeb, composedBuildPalette, COMPOSED_BUILD_SYSTEM } from "../../workers/visual/composed-protocol.mjs";

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

type PaletteHex = { bg: string; surface: string; fg: string; muted: string; accent: string };

async function composedResult(output: string, base: string, palette: PaletteHex, kind: ProjectKind): Promise<GatedProduct> {
  const html = await applyComposedBuildPlanWeb(base, JSON.parse(output));
  return {
    name: html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim().slice(0, 80) || "Studio",
    tagline: "", summary: "", direction: "", kind, palette, html,
    files: [{ path: "index.html", content: html }],
  };
}

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

export function parseResult(output: string, lockKind?: string, brief?: string) {
  const htmlMatch = output.match(/<!DOCTYPE html[\s\S]*?<\/html>/i) ?? output.match(/<html[\s\S]*?<\/html>/i);
  if (!htmlMatch) return null;
  const html = enforceGraphicIntent(htmlMatch[0].startsWith("<!DOCTYPE") ? htmlMatch[0] : `<!DOCTYPE html>\n${htmlMatch[0]}`, brief || "");
  if (html.length < 80) return null;

  const metaMatch = output.match(/<<<META>>>\s*([\s\S]*?)(?:<<<HTML>>>|<<<FILE |<<<END>>>|$)/);
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(metaMatch?.[1]?.trim() || "{}") as Record<string, unknown>;
  } catch {
    meta = {};
  }
  const paletteIn = meta.palette && typeof meta.palette === "object"
    ? (meta.palette as Record<string, unknown>)
    : {};
  const hashed = brief ? fallbackPaletteFromBrief(brief) : fallbackPaletteFromBrief("studio");
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || "Studio";
  const kinds = ["landing", "app", "dashboard", "tool", "game", "site"];
  const parsed =
    typeof meta.kind === "string" && kinds.includes(meta.kind) ? meta.kind : "app";
  const kind = (lockKind && kinds.includes(lockKind) ? lockKind : parsed) as ProjectKind;

  const extra = parseProjectFiles(output);
  const files = ingestProjectFiles(extra, { html }).files;

  return {
    name: cleanText(meta.name, title, 80),
    tagline: cleanText(meta.tagline, "", 120),
    kind,
    summary: cleanText(meta.summary, "", 280),
    direction: cleanText(meta.direction, "", 80),
    palette: {
      bg: hex(paletteIn.bg, hashed.bg),
      surface: hex(paletteIn.surface, hashed.surface),
      fg: hex(paletteIn.fg, hashed.fg),
      muted: hex(paletteIn.muted, hashed.muted),
      accent: hex(paletteIn.accent, hashed.accent),
    },
    html,
    files,
  };
}

function stage(output: string) {
  if (/<\/html>/i.test(output)) return "Apro l'anteprima";
  if (/<!DOCTYPE html|<<<HTML>>>/i.test(output)) return "Scrivo l'interfaccia";
  if (/<<<META>>>|\"direction\"\s*:|\"name\"\s*:/i.test(output)) return "Applico la direzione visiva";
  return output.trim().length > 8 ? "Compongo colori, icone, interfaccia" : null;
}

async function designDirection(apiKey: string, prompt: string, recent?: PaletteRecord[]) {
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
            content: `BRIEF:\n${prompt}\n\n${tokensInstruction(tokensFromBrief(prompt, { recent }))}\n\n${grammarInstruction(grammarFromBrief(prompt))}\n\nRestituisci un unico JSON di direzione visiva, senza markdown. Vietato cadere su #101114/#191b20/#e1693f.`,
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

export async function reviewPass(apiKey: string, prompt: string, html: string, spec: string) {
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
            content: `BRIEF:\n${prompt}\n\n${spec ? `DIREZIONE VISIVA:\n${spec}\n\n` : ""}HTML DA RIVEDERE:\n${artifactContext(html)}\n\nRivedi la grafica, tieni le funzioni, META+HTML.`,
          },
        ],
      }),
    });
    if (!response.ok) return "";
    const json = (await response.json()) as GrokChunk;
    if (json.choices?.[0]?.finish_reason != null && json.choices[0].finish_reason !== "stop") return "";
    return textValue(json.choices?.[0]?.message?.content);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

const REPAIR_MAX = 2;
if (REPAIR_MAX !== CONTRACT_REPAIR_MAX) {
  throw new Error("repair cap drift");
}

export async function repairPass(apiKey: string, prompt: string, html: string, error: string, files?: { path: string; content: string }[], composed = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const filesContext = repairFilesContext(files);
    const content = composed
      ? `BRIEF:\n${prompt}\nERRORI:\n${error}\nBASE_SHA256:${await composedBaseShaWeb(html)}\nHTML ORIGINALE:\n${artifactContext(html)}`
      : `BRIEF:\n${prompt}\n\nERRORI:\n${error}\n\nHTML:\n${artifactContext(html)}${filesContext}\n\nRestituisci META + eventuali <<<FILE path="...">>> + <<<HTML>>> + <<<END>>>. Niente server inventato.`;
    const response = await fetch(XAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 8000,
        stream: false,
        messages: [
          { role: "system", content: composed ? COMPOSED_BUILD_SYSTEM : REPAIR_PROMPT },
          {
            role: "user",
            content,
          },
        ],
      }),
    });
    if (!response.ok) return "";
    const json = (await response.json()) as GrokChunk;
    if (composed && json.choices?.[0]?.finish_reason !== "stop") return "";
    if (json.choices?.[0]?.finish_reason != null && json.choices[0].finish_reason !== "stop") return "";
    return textValue(json.choices?.[0]?.message?.content);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function gateResult(
  apiKey: string,
  prompt: string,
  result: { html: string; kind?: ProjectKind; files?: { path: string; content: string }[]; name?: string; tagline?: string; summary?: string; direction?: string; palette?: PaletteHex } | null,
  send: (event: StreamEvent) => void,
  contract = planContract(prompt),
  compositionPalette?: PaletteHex,
): Promise<{ error: string; result?: GatedProduct } | { result: GatedProduct }> {
  if (!result?.html) return { error: "Risposta incompleta. Riprova." };
  const gated = await gateIncompleteHtml({
    apiKey,
    prompt,
    result: {
      name: result.name || "Studio",
      tagline: result.tagline || "",
      kind: result.kind || "app",
      summary: result.summary || "",
      direction: result.direction || "",
      palette: result.palette || fallbackPaletteFromBrief(prompt),
      html: result.html,
      files: result.files || [{ path: "index.html", content: result.html }],
    },
    contract,
    files: result.files,
    onStage: (s) => send({ t: "s", s }),
    repair: async ({ html, error, files }) => {
      const fixed = await repairPass(apiKey, prompt, html, error, files, Boolean(compositionPalette));
      if (compositionPalette) return composedResult(fixed, html, compositionPalette, contract.kind);
      return parseResult(fixed, kindFromPrompt(prompt), prompt);
    },
  });
  if ("error" in gated) return { error: gated.error || "Verifica del prodotto non superata.", result: gated.result };
  return { result: gated.result };
}

export default async function build(request: Request) {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const apiKey = Netlify.env.get("XAI_API_KEY")?.trim();
  if (!apiKey) {
    return Response.json({ t: "err", error: "Manca XAI_API_KEY sul server" }, { status: 503 });
  }

  let body: { prompt?: string; html?: string; instruction?: string; shot?: string; operation?: string; palette?: unknown };
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
  const currentHtml = body.html ?? "";
  if (typeof currentHtml !== "string") {
    return Response.json({ t: "err", error: "HTML non valido." }, { status: 400 });
  }
  if (currentHtml.length > MAX_ARTIFACT_CHARS) {
    return Response.json({ t: "err", error: "Documento troppo grande per una modifica sicura. La versione precedente resta invariata." }, { status: 413 });
  }
  const shot =
    typeof body.shot === "string" && body.shot.startsWith("data:image")
      ? body.shot.slice(0, 380000)
      : "";
  const lockKind = kindFromPrompt(prompt);
  const contract = planContract(prompt);
  // The atomic HTML protocol cannot provide backend/auth or other source files.
  // Such contracts retain the full-project path; never silently drop their files.
  const composed = body.operation === "create" && isPhoneKind(lockKind ?? contract.kind)
    && isComposedVisualArtifact(currentHtml) && contract.files.every(path => path === "index.html");
  let compositionPalette: PaletteHex | undefined;
  let compositionContext = "";
  if (composed) {
    try {
      compositionPalette = composedBuildPalette(body.palette) as PaletteHex;
      compositionContext = `BRIEF:\n${prompt}\nDIREZIONE:\n${instruction}\nBASE_SHA256:${await composedBaseShaWeb(currentHtml)}\nHTML ORIGINALE:\n${artifactContext(currentHtml)}`;
    } catch {
      return Response.json({ t: "err", error: "Composizione o palette non valida. La versione precedente resta invariata." }, { status: 400 });
    }
  }
  const recent = sanitizePaletteHistory((body as { recentPalettes?: PaletteRecord[] }).recentPalettes);
  const tokens = tokensFromBrief(prompt, { recent });
  const grammar = grammarFromBrief(prompt);
  const userParts = [
    `BRIEF:\n${prompt}`,
    formatPrefix(lockKind ?? "app").trim(),
    contractInstruction(contract),
    tokensInstruction(tokens),
    grammarInstruction(grammar),
    "Crea un prodotto completo, specifico e immediatamente utilizzabile. Vietato cadere su #101114/#191b20/#e1693f.",
    instruction && currentHtml ? `APP ATTUALE:\n${currentHtml}` : "",
    instruction ? `MODIFICA:\n${instruction}\nRestituisci il documento completo.` : "",
    shot ? "SCREENSHOT allegato: VEDI l'anteprima e correggi chrome, tab, icone, contrasto. Tieni il JS." : "",
    "Costruisci ora. Formato META + <<<FILE path>>> se il contratto li chiede + <<<HTML>>> + <<<END>>>.",
  ].filter(Boolean);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let terminal = false;
      let output = "";
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
      const send = (event: StreamEvent) => {
        enqueue(sse(event));
      };
      const finish = (event: StreamEvent) => {
        if (terminal || closed) return;
        terminal = true;
        send(event);
      };
      const heartbeat = setInterval(() => {
        enqueue(": ping\n\n");
      }, 4000);

      try {
        let spec = "";
        send({
          t: "s",
          s: formatReceipt(
            roleReceipt({
              role: "planner",
              ok: true,
              checks: contract.acceptance,
              skipped: true,
              reason: "static",
              tokens: 0,
            }),
          ),
        });
        if (!instruction && !composed) {
          send({ t: "s", s: "Direzione visiva" });
          spec = await designDirection(apiKey, prompt, recent);
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
              { role: "system", content: composed ? COMPOSED_BUILD_SYSTEM : lockKind === "site" || lockKind === "landing" ? SITE_PROMPT : SYSTEM_PROMPT },
              {
                role: "user",
                content: composed ? compositionContext : shot
                  ? [
                      { type: "text", text: userParts.join("\n\n") },
                      { type: "image_url", image_url: { url: shot } },
                    ]
                  : userParts.join("\n\n"),
              },
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
        let completed = false;
        const ingest = (payload: string) => {
          if (terminal || !payload || payload === "[DONE]") return;
          let json: GrokChunk;
          try {
            json = JSON.parse(payload) as GrokChunk;
          } catch {
            return;
          }
          const reason = json.choices?.[0]?.finish_reason;
          if (reason === "stop") completed = true;
          if (reason != null && reason !== "stop") {
            finish({ t: "err", error: "Risposta del modello incompleta. La versione precedente resta invariata." });
            return;
          }
          const piece = chunkParts(json);
          if (piece.error) {
            finish({ t: "err", error: piece.error });
            return;
          }
          if (!piece.content) return;
          output += piece.content;
          if (composed && output.length > MAX_ARTIFACT_CHARS) {
            finish({ t: "err", error: "Piano di creazione troppo grande. La versione precedente resta invariata." });
            return;
          }
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
        if (terminal) {
          await reader.cancel().catch(() => {});
          return;
        }
        if (!terminal) {
          if (composed && !completed) throw new Error("Risposta del modello incompleta");
          let result = compositionPalette
            ? await composedResult(output, currentHtml, compositionPalette, contract.kind)
            : parseResult(output, lockKind, prompt);
          const desk = lockKind === "site" || lockKind === "landing" || lockKind === "dashboard";
          const evaluation = result
            ? evaluateContract({
                html: result.html,
                files: result.files,
                contract,
                kind: (lockKind as typeof contract.kind | undefined) ?? contract.kind,
                brief: prompt,
              })
            : { ok: false, kind: contract.kind, checks: [] };
          const budget = criticBudget({
            kind: lockKind ?? contract.kind,
            instruction,
            shot: Boolean(shot),
            evaluation,
          });
          if (result && !desk && budget.call && !composed) {
            send({ t: "s", s: "QA" });
            const reviewed = await reviewPass(apiKey, prompt, result.html, spec);
            result = parseResult(reviewed, lockKind, prompt) ?? result;
          } else if (result) {
            send({
              t: "s",
              s: formatReceipt(
                roleReceipt({
                  role: "critic",
                  ok: evaluation.ok,
                  skipped: true,
                  reason: composed ? "atomic-contract-gate" : budget.reason,
                  checks: evaluation.checks.filter((c) => c.ok).map((c) => c.id),
                }),
              ),
            });
          }
          const gated = await gateResult(apiKey, prompt, result, send, contract, compositionPalette);
          if ("error" in gated) finish({ t: "err", error: gated.error });
          else finish({ t: "ok", result: gated.result });
        }
      } catch (error) {
        if (terminal) return;
        if (composed) {
          finish({ t: "err", error: `Creazione non completata: ${error instanceof Error ? error.message : "piano non valido"}. La versione precedente resta invariata.` });
          return;
        }
        // A rejected atomic plan must never be interpreted as a full HTML rewrite.
        const salvage = parseResult(output, lockKind, prompt);
        if (salvage) {
          const gated = await gateResult(apiKey, prompt, salvage, send, contract);
          if ("error" in gated) {
            finish({ t: "err", error: gated.error });
          } else {
            finish({ t: "ok", result: gated.result });
          }
        } else {
          finish({
            t: "err",
            error: error instanceof Error ? `Non riesco a raggiungere il modello (${error.message}).` : "Errore di rete. Riprova.",
          });
        }
      } finally {
        clearInterval(heartbeat);
        if (!terminal) finish({ t: "err", error: "Non è arrivata una risposta dal modello. Riprova." });
        closed = true;
        try {
          controller.close();
        } catch {
          /* The browser may already have cancelled the response stream. */
        }
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
