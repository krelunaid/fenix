import { XAI_CHAT_COMPLETIONS_URL, XAI_MODEL } from "./model";
import { VISUAL_PROMPT } from "./prompts.shared";

export { VISUAL_PROMPT } from "./prompts.shared";

export async function designVisual(input: {
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
      model: XAI_MODEL,
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
