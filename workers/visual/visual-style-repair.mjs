import { isComposedVisualArtifact } from './visual-style.mjs';
import { verifyVisualStyleEffect } from './visual-style-effect.mjs';
import { isTerminalVisualPolishError } from './visual-style-keep.mjs';

export { VISUAL_STYLE_SKIPPED_LOG, canKeepComposedSeedAfterPolishError, isTerminalVisualPolishError, shouldSkipComposedPolish } from './visual-style-keep.mjs';

export const VISUAL_STYLE_REPAIR_MAX = 2;

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
