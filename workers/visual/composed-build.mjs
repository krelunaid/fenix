import { createHash } from "node:crypto";
import { artifactContext } from "./artifact-context.mjs";
import { applyComposedBuildPlanForDigest } from "./composed-protocol.mjs";

export { composedBuildPalette, COMPOSED_BUILD_SYSTEM } from "./composed-protocol.mjs";

/** Synchronous Node entrypoint retained for the existing worker.
 * @param {string} html
 */
export const composedBaseSha = html => createHash("sha256").update(html).digest("hex");

/** @param {string} html @param {unknown} plan */
export function applyComposedBuildPlan(html, plan) {
  artifactContext(html);
  return applyComposedBuildPlanForDigest(html, plan, composedBaseSha(html));
}
