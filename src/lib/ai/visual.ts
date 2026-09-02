import { FENIX_MODEL, XAI_CHAT_COMPLETIONS_URL } from "./model";
import { VISUAL_PROMPT } from "./prompts.shared";
import { tokensInstruction, tokensFromBrief } from "../projects/design-tokens.ts";
import { grammarFromBrief, grammarInstruction } from "../projects/layout-grammar.ts";

export { VISUAL_PROMPT } from "./prompts.shared";

export async function designVisual(input: {
  apiKey: string;
  prompt: string;
  signal: AbortSignal;
  recentPalettes?: import("../projects/palette-engine.ts").PaletteRecord[];
}): Promise<string | null> {
  const tokens = tokensFromBrief(input.prompt, { recent: input.recentPalettes });
  const grammar = grammarFromBrief(input.prompt);
  const res = await fetch(XAI_CHAT_COMPLETIONS_URL, {
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
          content: `BRIEF:\n${input.prompt}\n\n${tokensInstruction(tokens)}\n\n${grammarInstruction(grammar)}\n\nJSON unico, nient'altro. Palette, font e layout nati da QUESTO brief, non da un altro prodotto.`,
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
