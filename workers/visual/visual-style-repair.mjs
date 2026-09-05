import { COMPOSED_PLAN_DEGRADED_LOG } from './composed-protocol.mjs';
import { isComposedVisualArtifact } from './visual-style.mjs';
import { verifyVisualStyleEffect } from './visual-style-effect.mjs';

export const VISUAL_STYLE_REPAIR_MAX = 2;
export const VISUAL_STYLE_SKIPPED_LOG = "Rifinitura visuale saltata; seed composto invariato";

/** Repair rejected model plans against the unchanged artifact, never weaken CSS gates.
 * Transport failures remain terminal: only a received but invalid plan is retried.
 * @param {string} html
 * @param {(feedback: null | {attempt:number, reply:string, error:string}) => Promise<string>} requestPlan
 * @param {(html:string, plan:unknown) => Promise<string>} verify
 */
export async function repairVisualStyle(html, requestPlan, verify = verifyVisualStyleEffect) {
  let feedback = null;
  for (let attempt = 0; attempt <= VISUAL_STYLE_REPAIR_MAX; attempt++) {
    const reply = await requestPlan(feedback);
    if (typeof reply !== 'string' || reply.length > 16000) throw new Error('Piano visuale troppo grande');
    try {
      const styled = await verify(html, JSON.parse(reply));
      return {html:styled, repairs:attempt};
    } catch (error) {
      if (attempt === VISUAL_STYLE_REPAIR_MAX) throw error;
      feedback = {attempt:attempt+1, reply, error:error instanceof Error ? error.message.slice(0,240) : 'Piano visuale non valido'};
    }
  }
  throw new Error('Rifinitura visuale non completata');
}

/** Automatic composed polish may keep a valid craft seed instead of failing closed.
 * Invalid CSS is still never applied. Transport/oversize stay terminal.
 * @param {string} html
 * @param {(feedback: null | {attempt:number, reply:string, error:string}) => Promise<string>} requestPlan
 * @param {(html:string, plan:unknown) => Promise<string>} verify
 */
export async function repairVisualStyleOrKeep(html, requestPlan, verify = verifyVisualStyleEffect) {
  try {
    return { ...(await repairVisualStyle(html, requestPlan, verify)), skipped: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Piano visuale non valido";
    if (!isComposedVisualArtifact(html) || isTerminalVisualPolishError(reason)) throw error;
    return { html, repairs: 0, skipped: true, reason };
  }
}

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
