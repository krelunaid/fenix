import { FENIX_MODEL } from "./model";

export const VISUAL_PROMPT = `Sei l'agente visivo di Fenix, come l'art director di uno studio prodotto (tipo Emergent).
Dal brief inventi UN sistema visivo unico. Niente codice. Solo JSON valido:

{"name":"","kind":"landing|app|dashboard|tool|game|site","mood":"4-6 parole","layout":"app-shell|split|magazine|full-bleed|tool","palette":{"bg":"#rrggbb","surface":"#rrggbb","fg":"#rrggbb","muted":"#rrggbb","accent":"#rrggbb","line":"#rrggbb"},"fonts":{"display":"Google Font","body":"Google Font"},"radius":"2px|10px|20px|980px","icon":{"motif":"oggetto del mestiere","mark":"pittogramma SVG 24px in una frase"},"tabs":[{"id":"","label":"","glyph":"forma SVG"}],"photo":"soggetto unsplash + trattamento","dont":["cosa vietata per questo brief"]}

Regole:
- Palette NATA dal mestiere/luogo. Mai #f5f5f7, mai viola AI, mai lo stesso rame se il brief non è officina.
- Display ≠ body. Mai Inter, mai Manrope di default.
- App: 3–4 tabs con glyph diversi (calendario, cassa, attrezzo…). Icona app = un oggetto, non una lettera.
- Sito: layout magazine o split, non hero centrato clone.
- mood e photo devono essere specifici (città, materiale, ora del giorno).`;

export async function designVisual(input: {
  apiKey: string;
  prompt: string;
  signal: AbortSignal;
}): Promise<string | null> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    signal: input.signal,
    body: JSON.stringify({
      model: FENIX_MODEL,
      temperature: 0.85,
      max_tokens: 2500,
      stream: false,
      messages: [
        { role: "system", content: VISUAL_PROMPT },
        { role: "user", content: input.prompt },
      ],
    }),
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content ?? "";
  return text.match(/\{[\s\S]*\}/)?.[0] ?? null;
}
