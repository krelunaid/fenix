import { isComposedVisualArtifact } from './visual-style.mjs';
import { isModelCreatedArtifact, looksLikeFenixComposeSeed } from './composed-create.mjs';

/** Browser-safe keep-seed helpers. Do not import Playwright from this module. */

export const VISUAL_STYLE_SKIPPED_LOG = "Rifinitura visuale saltata; seed composto invariato";

/** @param {string} reason */
export function isTerminalVisualPolishError(reason) {
  return /troppo grande|network interrupted|xAI \d|load failed|failed to fetch|timeout|aborted|ERR_NETWORK/i.test(String(reason || ""));
}

/**
 * TypeScript seed is never the product: polish must ask grok-build for an original
 * document. An already-original grok-build artifact must not be CSS/tab-patched.
 * @param {{instruction?: string, html?: string, buildLog?: string[]}} [input]
 */
export function shouldSkipComposedPolish(input) {
  const html = String(input?.html || "");
  if (looksLikeFenixComposeSeed(html)) return false;
  return isModelCreatedArtifact(html);
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
