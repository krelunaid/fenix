import { parseBuildOutput, type BuildResult } from "./parse.ts";
import { FENIX_MODEL, XAI_CHAT_COMPLETIONS_URL } from "./model.ts";
import { REPAIR_PROMPT } from "./prompts.shared.ts";
import { kindFromPrompt } from "../projects/infer.ts";
import {
  gateIncompleteHtml,
  type GateOutcome,
} from "../projects/fenix-adapter.ts";
import type { BuildContract } from "./build-contract.ts";
import type { ProjectFile } from "../projects/files.ts";
import { artifactContext, completeResponseText, MAX_ARTIFACT_CHARS } from "../../../workers/visual/artifact-context.mjs";

export { REPAIR_PROMPT } from "./prompts.shared.ts";

export { ensureFenixAdapter, htmlHasFenixApi, FENIX_ADAPTER_SCRIPT } from "../projects/fenix-adapter.ts";
export type { GateOutcome };

export async function repairBuild(input: {
  apiKey: string;
  prompt: string;
  html: string;
  error: string;
  signal?: AbortSignal;
}): Promise<BuildResult | null> {
  if (input.html.length > MAX_ARTIFACT_CHARS) return null;
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
          content: `BRIEF:\n${input.prompt}\n\nERRORI DI VALIDAZIONE:\n${input.error}\n\nHTML DA RIPARARE:\n${artifactContext(input.html)}\n\nRestituisci META + eventuali <<<FILE path="...">>> + <<<HTML>>> + <<<END>>>. Niente server inventato.`,
        },
      ],
    }),
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as {
    choices?: { finish_reason?: string | null; message?: { content?: string } }[];
  };
  let text: string;
  try { text = completeResponseText(payload); } catch { return null; }
  return parseBuildOutput(text, kindFromPrompt(input.prompt), input.prompt);
}

export async function gateBuildResult(input: {
  apiKey: string;
  prompt: string;
  result: BuildResult;
  signal?: AbortSignal;
  onStage?: (stage: string) => void;
  repair?: typeof repairBuild;
  contract?: BuildContract;
  files?: ProjectFile[];
}): Promise<GateOutcome> {
  return gateIncompleteHtml({
    ...input,
    repair: input.repair ?? repairBuild,
  });
}
