import { createHash } from "node:crypto";
import { artifactContext } from "./artifact-context.mjs";
import { applyComposedBuildPlanForDigest } from "./composed-protocol.mjs";

export {
  composedBuildPalette,
  COMPOSED_BUILD_SYSTEM,
  COMPOSED_BUILD_FIND_EXAMPLES,
  COMPOSED_PLAN_APPLY_RETRIES,
  COMPOSED_PLAN_DEGRADED_LOG,
  applyComposedBuildPlanOrSeed,
  isRetryableComposedPlanError,
  composedBuildUserContent,
  composedPlanRetryFeedback,
  composedSeedAnchors,
  composedFindStatus,
} from "./composed-protocol.mjs";

export {
  applyCreatedDocumentOrSeed,
  applyCreatedDeskDocumentOrSeed,
  applyCreatedGraphicOrKeep,
  composedCreateRetryFeedback,
  composedCreateUserContent,
  composedDeskCreateUserContent,
  composedGraphicRetryFeedback,
  composedGraphicUserContent,
  COMPOSED_CREATE_APPLIED_LOG,
  COMPOSED_CREATE_GRAPHIC_APPLIED_LOG,
  COMPOSED_CREATE_GRAPHIC_KEPT_LOG,
  COMPOSED_CREATE_SYSTEM,
  COMPOSED_DASH_CREATE_SYSTEM,
  COMPOSED_DESK_CREATE_APPLIED_LOG,
  COMPOSED_DESK_GRAPHIC_SYSTEM,
  COMPOSED_SITE_CREATE_SYSTEM,
  createdDocumentBeatsSeed,
  createdDeskDocumentBeatsSeed,
  deskCreateSystemFor,
  DESK_VIEWPORT,
  extractCreatedHtml,
  isModelCreatedArtifact,
  isUserIterateInstruction,
  looksLikeFenixComposeSeed,
  looksLikeFenixWebsiteSeed,
  looksLikePhoneChromeOnDesk,
  markModelCreatedHtml,
  PHONE_VIEWPORT,
} from "./composed-create.mjs";

/** Synchronous Node entrypoint retained for the existing worker.
 * @param {string} html
 */
export const composedBaseSha = html => createHash("sha256").update(html).digest("hex");

/** @param {string} html @param {unknown} plan */
export function applyComposedBuildPlan(html, plan) {
  artifactContext(html);
  return applyComposedBuildPlanForDigest(html, plan, composedBaseSha(html));
}
