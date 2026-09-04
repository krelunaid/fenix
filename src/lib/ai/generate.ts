import { createServerFn } from "@tanstack/react-start";
import { parseBuildOutput, type BuildResult } from "./parse";
import { FENIX_MODEL, getXaiApiKey, XAI_CHAT_COMPLETIONS_URL, XAI_MISSING_KEY_ERROR } from "./model";
import { SYSTEM_PROMPT } from "./prompt";
import { kindFromPrompt } from "@/lib/projects/infer";
import { contractInstruction, planContract } from "./build-contract";
import { composeProduct } from "./compose-product";
import { sanitizePaletteHistory, type PaletteRecord } from "@/lib/projects/palette-engine";

export type GenerateInput = {
  prompt: string;
  html?: string;
  instruction?: string;
  recentPalettes?: PaletteRecord[];
};

export type GenerateResponse =
  | { ok: true; result: BuildResult }
  | { ok: false; error: string };

export const getAiStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { available: Boolean(getXaiApiKey()) };
});

export const generateBuild = createServerFn({ method: "POST" })
  .validator((data: GenerateInput) => {
    const prompt = (data.prompt ?? "").trim();
    if (prompt.length < 3) {
      throw new Error("Scrivi un brief più chiaro.");
    }
    return {
      prompt: prompt.slice(0, 2500),
      html: (data.html ?? "").slice(0, 50000),
      instruction: (data.instruction ?? "").trim().slice(0, 2500),
      recentPalettes: sanitizePaletteHistory(data.recentPalettes),
    };
  })
  .handler(async ({ data }): Promise<GenerateResponse> => {
    // Server-only. Never VITE_XAI_API_KEY — that would leak to the browser.
    const apiKey = getXaiApiKey();
    if (!apiKey) {
      return { ok: false, error: XAI_MISSING_KEY_ERROR };
    }

    const composed = composeProduct(data.prompt, { recent: data.recentPalettes });
    const userParts = [
      `BRIEF:\n${data.prompt}`,
      contractInstruction(planContract(data.prompt)),
      composed.polish,
      `VINCOLO UNICITÀ: prodotto visivamente unico, nato dal brief. Token cromatici del contratto. Vietato clone #f5f5f7 + Manrope + hero centrato. Vietato beige/terracotta se il brief non è ceramica. Grammatica ${composed.grammar.id}, non la stessa phone-shell.`,
    ];
    if (data.html) {
      userParts.push(`HTML ATTUALE:\n${data.html}`);
    }
    if (data.instruction) {
      userParts.push(`MODIFICA RICHIESTA:\n${data.instruction}`);
    }
    userParts.push("Restituisci META + HTML completi nel formato richiesto.");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const res = await fetch(XAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: FENIX_MODEL,
          temperature: data.instruction ? 0.55 : 0.92,
          max_tokens: 14000,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userParts.join("\n\n") },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 429) {
          return { ok: false, error: "Troppe richieste. Attendi un momento e riprova." };
        }
        return {
          ok: false,
          error: `Il modello non ha risposto (${res.status}). ${body.slice(0, 180)}`.trim(),
        };
      }

      const payload = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = payload.choices?.[0]?.message?.content ?? "";
      const parsed = parseBuildOutput(text, kindFromPrompt(data.prompt), data.prompt);
      if (!parsed) {
        return {
          ok: false,
          error: "Ho ricevuto una risposta incompleta. Riprova con un brief più stretto.",
        };
      }
      return { ok: true, result: parsed };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      const detail = err instanceof Error ? err.message : "errore sconosciuto";
      console.error("[fenix] generateBuild failed", err);
      return {
        ok: false,
        error: aborted
          ? "La generazione ha impiegato troppo. Accorcia il brief e riprova."
          : `Non riesco a raggiungere il modello (${detail}). Riprova.`,
      };
    } finally {
      clearTimeout(timeout);
    }
  });
