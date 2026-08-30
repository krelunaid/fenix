import { FENIX_MODEL } from "./model";

export const VISUAL_PROMPT = `Sei l'art director di Fenix. Inventi un sistema visivo da manifesto, non un admin template. Niente HTML. SOLO JSON:

{"name":"","kind":"landing|app|dashboard|tool|game|site","mood":"materiale + ora + luogo","layout":"app-shell|split|magazine|full-bleed|tool","palette":{"bg":"#rrggbb","surface":"#rrggbb","fg":"#rrggbb","muted":"#rrggbb","accent":"#rrggbb","line":"#rrggbb"},"fonts":{"display":"Google Font","body":"Google Font"},"radius":"2px|4px|12px|24px|999px","type":{"h1":"clamp","body":"15-17px","label":"10px uppercase tracking"},"icon":{"motif":"1 oggetto fisico del mestiere","svg":"descrivi path 32×32, 2 colori palette, niente lettera"},"tabs":[{"id":"","label":"max 10 char","glyph":"forma outline 28px unica"}],"photo":{"unsplash":"photo-XXXXXXXX","treatment":"es. grain + desat","alt":""},"dont":["3 cose vietate PER QUESTO brief"]}

Regole dure:
- Palette dal mestiere/luogo/ora (mattone, inchiostro, olio, calce, cloro, vernice…). bg ≠ surface. Accento usato poco.
- Vietato: #f5f5f7 #ffffff #1d1d1f viola AI rame-officina se non è un'officina, Inter, Manrope, hero centrato, pill nera, glass, neon, emoji.
- Font: coppia Google rara e coerente (es. Fraunces+Source Sans 3, Syne+Figtree, Newsreader+IBM Plex Sans, Bebas Neue+Karla). Display ≠ body.
- App: 3–4 tab con glyph DIVERSI; icona app = oggetto, quadrato rx 13.
- Sito: magazine o split; foto unsplash reale photo- &w=1600, non stock smile.
- mood specifico: "terracotta mezzogiorno Grottaglie", non "elegante moderno".`;

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
      temperature: 0.9,
      max_tokens: 2500,
      stream: false,
      messages: [
        { role: "system", content: VISUAL_PROMPT },
        {
          role: "user",
          content: `BRIEF:\n${input.prompt}\n\nJSON unico, nient'altro. Palette che non hai mai usato per un altro prodotto.`,
        },
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
