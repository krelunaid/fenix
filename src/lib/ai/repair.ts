import { parseBuildOutput, type BuildResult } from "./parse";
import { FENIX_MODEL, XAI_CHAT_COMPLETIONS_URL } from "./model";
import { kindFromPrompt } from "@/lib/projects/infer";
import {
  gateIncompleteHtml,
  type GateOutcome,
} from "@/lib/projects/fenix-adapter";

export const REPAIR_PROMPT = `Sei il riparatore di Fenix. L'HTML ha JS rotto o markup con \${} stampato.

Obbligo:
1) Ripara la sintassi JS (parentesi, virgole, template). Compila senza eseguirlo.
2) Togli \${...} dal markup HTML. In JS usa concatenazione o template SOLO dentro <script>.
3) Tieni le funzioni. Almeno 3 viste data-view collegate, window.Fenix.load/save, niente localStorage.
4) Documento completo <!DOCTYPE html> … </html>.

Rispondi SOLO META + HTML completo.`;

export { ensureFenixAdapter, htmlHasFenixApi, FENIX_ADAPTER_SCRIPT } from "@/lib/projects/fenix-adapter";
export type { GateOutcome };

export async function repairBuild(input: {
  apiKey: string;
  prompt: string;
  html: string;
  error: string;
  signal?: AbortSignal;
}): Promise<BuildResult | null> {
  const res = await fetch(XAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    signal: input.signal,
    body: JSON.stringify({
      model: FENIX_MODEL,
      temperature: 0.2,
      max_tokens: 8000,
      stream: false,
      messages: [
        { role: "system", content: REPAIR_PROMPT },
        {
          role: "user",
          content: `BRIEF:\n${input.prompt}\n\nERRORI DI VALIDAZIONE:\n${input.error}\n\nHTML DA RIPARARE:\n${input.html.slice(0, 40000)}\n\nRestituisci il documento corretto, META+HTML.`,
        },
      ],
    }),
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content ?? "";
  return parseBuildOutput(text, kindFromPrompt(input.prompt));
}

export async function gateBuildResult(input: {
  apiKey: string;
  prompt: string;
  result: BuildResult;
  signal?: AbortSignal;
  onStage?: (stage: string) => void;
  repair?: typeof repairBuild;
}): Promise<GateOutcome> {
  return gateIncompleteHtml({
    ...input,
    repair: input.repair ?? repairBuild,
  });
}
