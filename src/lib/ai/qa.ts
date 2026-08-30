import { parseBuildOutput, type BuildResult } from "./parse";
import { FENIX_MODEL } from "./model";
import { QA_PROMPT } from "./prompts.shared";

export { QA_PROMPT } from "./prompts.shared";

export function looksCheap(html: string) {
  const h = html.toLowerCase();
  if (!html || html.length < 400) return true;
  const apple = h.includes("#f5f5f7") || h.includes("manrope") || h.includes("font-family: inter");
  const svgs = (h.match(/<svg/g) || []).length;
  const noMark = !h.includes('rel="icon"') && !h.includes("rel='icon'");
  const noTabs = !h.includes("data-view") && !h.includes("tabbar") && !h.includes("id=\"tabs\"");
  return apple || noMark || noTabs || svgs < 6;
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
      reasoning_effort: "low",
      temperature: 0.35,
      max_tokens: 12000,
      stream: false,
      messages: [
        { role: "system", content: QA_PROMPT },
        {
          role: "user",
          content: [
            `BRIEF:\n${input.prompt}`,
            input.spec ? `DIREZIONE VISIVA (legge):\n${input.spec}` : "",
            `HTML DA RIVEDERE (anteprima telefono):\n${input.html.slice(0, 40000)}`,
            "Se non sembra un'app da tasca (tab, icone, form, metriche), rifai il chrome. Tieni le funzioni. META+HTML.",
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
