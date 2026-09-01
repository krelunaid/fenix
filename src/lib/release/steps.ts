import type { Platform, ReleaseStep } from "./types.ts";

export const STEP_ORDER: ReleaseStep[] = [
  "preflight",
  "build",
  "sign",
  "upload",
  "processing",
  "ready",
];

export const NATIVE_PIPELINE_STEPS: ReleaseStep[] = ["build", "sign", "upload"];

export function nextStep(step: ReleaseStep): ReleaseStep {
  const i = STEP_ORDER.indexOf(step);
  if (i < 0 || i >= STEP_ORDER.length - 1) return "ready";
  return STEP_ORDER[i + 1]!;
}

export function isNativePipelineStep(step: ReleaseStep): boolean {
  return NATIVE_PIPELINE_STEPS.includes(step);
}

export function nativePipelineIntent(jobId: string, platform: Platform): string {
  return `${jobId}:${platform}:native`;
}
