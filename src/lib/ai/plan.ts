import { planContract } from "./build-contract";

export type BuildPlan = {
  name: string;
  kind: string;
  direction: string;
  screens: string[];
  collections: string[];
  fonts: string;
};

export { PLAN_PROMPT } from "./prompts.shared";

/** Deterministic. No xAI call, no credits. */
export async function planBuild(input: {
  apiKey: string;
  prompt: string;
  signal: AbortSignal;
}): Promise<string | null> {
  void input.apiKey;
  void input.signal;
  return JSON.stringify(planContract(input.prompt));
}
