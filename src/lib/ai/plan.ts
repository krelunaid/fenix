import { FENIX_MODEL, XAI_CHAT_COMPLETIONS_URL } from "./model";

export type BuildPlan = {
  name: string;
  kind: string;
  direction: string;
  screens: string[];
  collections: string[];
  fonts: string;
};

export const PLAN_PROMPT = `Sei l'agente piano di Fenix. Dal brief produci SOLO JSON valido, nient'altro:
{"name":"","kind":"landing|app|dashboard|tool|game|site","direction":"3-6 parole visive uniche","fonts":"Display + Body Google Fonts","screens":["home","..."],"collections":["nome_dati"],"palette":{"bg":"#","surface":"#","fg":"#","muted":"#","accent":"#"}}
Regole: identità nata dal brief; mai #f5f5f7+Manrope; app/tool ≥3 screens; sito screens = sezioni. collections = tabelle del prodotto.`;

export async function planBuild(input: {
  apiKey: string;
  prompt: string;
  signal: AbortSignal;
}): Promise<string | null> {
  const res = await fetch(XAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    signal: input.signal,
    body: JSON.stringify({
      model: FENIX_MODEL,
      temperature: 0.7,
      max_tokens: 700,
      reasoning_effort: "low",
      stream: false,
      messages: [
        { role: "system", content: PLAN_PROMPT },
        { role: "user", content: input.prompt },
      ],
    }),
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content ?? "";
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  return json ?? null;
}
