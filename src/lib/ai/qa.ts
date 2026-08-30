import { parseBuildOutput, type BuildResult } from "./parse";
import { FENIX_MODEL } from "./model";

export const QA_PROMPT = `Sei il secondo agente di Fenix: art director + tester. Hai già un HTML. Devi farlo SENTIRE un prodotto vero, come uno studio che rivede l'anteprima.

Obbligo:
1) Tieni JS, viste, dati, form che già girano. Non spegnere click e state.
2) RISCRIVI il visivo se è piatto: palette dal brief (materia, luogo, ora), font coppia Google rara, icona app SVG del mestiere 52px, tab bar 3–4 icone in basso in flusso (non position:fixed), foto unsplash photo- se è un sito.
3) Vietato #f5f5f7, Manrope, Inter, hero centrato, pill nera, viola AI, lorem, emoji, glass.
4) CSS :root --bg --surface --fg --muted --accent --line. body 100dvh. App colonna.

Rispondi SOLO:
<<<META>>>
{"name":"","tagline":"","kind":"landing|app|dashboard|tool|game|site","direction":"3-6 parole","summary":"","palette":{"bg":"#","surface":"#","fg":"#","muted":"#","accent":"#"}}
<<<HTML>>>
<!DOCTYPE html>...completo...
<<<END>>>`;

export function looksCheap(html: string) {
  const h = html.toLowerCase();
  if (!html || html.length < 200) return true;
  const apple = h.includes("#f5f5f7") || h.includes("manrope") || h.includes("font-family: inter");
  const noMark = !h.includes('rel="icon"') && !h.includes("rel='icon'");
  const noTabs = !h.includes("data-view") && !h.includes("class=\"tabs\"") && !h.includes("id=\"tabs\"");
  return apple || (noMark && noTabs);
}

export async function reviewBuild(input: {
  apiKey: string;
  prompt: string;
  html: string;
  spec?: string;
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
      temperature: 0.55,
      max_tokens: 8000,
      stream: false,
      messages: [
        { role: "system", content: QA_PROMPT },
        {
          role: "user",
          content: [
            `BRIEF:\n${input.prompt}`,
            input.spec ? `DIREZIONE VISIVA (legge):\n${input.spec}` : "",
            `HTML DA RIVEDERE (anteprima):\n${input.html.slice(0, 40000)}`,
            "Guarda come un umano: se è un template, rifai identità. Tieni le funzioni. META+HTML.",
          ]
            .filter(Boolean)
            .join("\n\n"),
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
