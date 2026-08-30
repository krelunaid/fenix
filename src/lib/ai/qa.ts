import { parseBuildOutput, type BuildResult } from "./parse";
import { FENIX_MODEL } from "./model";

export const QA_PROMPT = `Sei l'agente prova di Fenix. Ricevi brief + HTML. Il prodotto deve girare e non assomigliare a un template.

Fai, in quest'ordine:
1) Ripara JS rotto, click morti, form che non confermano, viste che non cambiano, calcoli sbagliati.
2) Se vedi #f5f5f7 + Manrope + hero centrato o tre card clone: riscrivi identità visiva dal brief (palette, font, layout, foto).
3) Completa: app/tool/gioco ≥3 viste + dati in localStorage con chiave unica. Sito ≥4 sezioni, nav, form, testi veri.
4) Tieni ciò che già funziona e ha carattere.

Rispondi SOLO nel formato Fenix: META + FILE path="styles.css"|db.js|app.js|index.html + END. Tieni i file separati. Usa window.Fenix.load/save se serve persistenza.`;

export async function reviewBuild(input: {
  apiKey: string;
  prompt: string;
  html: string;
  signal: AbortSignal;
}): Promise<BuildResult | null> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    signal: input.signal,
    body: JSON.stringify({
      model: FENIX_MODEL,
      temperature: 0.35,
      max_tokens: 12000,
      stream: false,
      messages: [
        { role: "system", content: QA_PROMPT },
        {
          role: "user",
          content: `BRIEF:\n${input.prompt}\n\nHTML DA PROVARE:\n${input.html.slice(0, 80000)}\n\nCorreggi e restituisci il prodotto completo.`,
        },
      ],
    }),
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content ?? "";
  return parseBuildOutput(text);
}
