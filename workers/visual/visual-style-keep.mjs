import { COMPOSED_PLAN_DEGRADED_LOG } from './composed-protocol.mjs';
import { isComposedVisualArtifact } from './visual-style.mjs';

/** Browser-safe keep-seed helpers. Do not import Playwright from this module. */

export const VISUAL_STYLE_SKIPPED_LOG = "Rifinitura visuale saltata; seed composto invariato";

/** @param {string} reason */
export function isTerminalVisualPolishError(reason) {
  return /troppo grande|network interrupted|xAI \d|load failed|failed to fetch|timeout|aborted|ERR_NETWORK/i.test(String(reason || ""));
}

/**
 * After create falls back to the unchanged seed, skip automatic style polish.
 * Explicit edits still go through the worker.
 * @param {{instruction?: string, html?: string, buildLog?: string[]}} input
 */
export function shouldSkipComposedPolish(input) {
  return !input?.instruction
    && isComposedVisualArtifact(input?.html || "")
    && Array.isArray(input?.buildLog)
    && input.buildLog.includes(COMPOSED_PLAN_DEGRADED_LOG);
}

/**
 * A valid composed seed must not become BLOCCATO when polish rejects a plan.
 * @param {string} error
 * @param {{instruction?: string, html?: string}} input
 */
export function canKeepComposedSeedAfterPolishError(error, input) {
  if (input?.instruction || !isComposedVisualArtifact(input?.html || "")) return false;
  const reason = String(error || "");
  if (!reason || /JOB_STILL_RUNNING|STALE_JOB|Job visivo non trovato/i.test(reason)) return false;
  return /Stile non consentito|Target visuale|Piano visuale|effetto visibile|Rifinitura visuale|Contratto visuale/i.test(reason);
}
