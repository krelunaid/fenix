import { composeProduct } from "./compose-product.ts";
import { isPhoneKind } from "../projects/infer.ts";
import type { ProjectKind } from "../projects/types.ts";
import type { TokenOptions } from "../projects/design-tokens.ts";
import { filesFor } from "./build-contract.ts";
import { isComposedVisualArtifact } from "../../../workers/visual/visual-style.mjs";

/** Once this request reaches the worker, do not retry it as a full-document build. */
export function isComposedCreation(body: { operation?: string; kind?: string }): boolean {
  return body.operation === "create" && isPhoneKind(body.kind);
}

/** Edge can preserve an HTML composition only when no extra source is required. */
export function isAtomicStreamCreation(body: { operation?: string; kind?: string; prompt: string; html?: string }): boolean {
  return isComposedCreation(body) && isComposedVisualArtifact(body.html || "")
    && filesFor(body.kind as ProjectKind, body.prompt).every(path => path === "index.html");
}

/** Shared before transport selection: a recipe match is not a validity gate. */
export function createBuildRequest(input: {
  prompt: string;
  html?: string;
  instruction?: string;
  kind: ProjectKind;
  recentPalettes?: TokenOptions["recent"];
}) {
  const { prompt, html, instruction, kind, recentPalettes = [] } = input;
  if (instruction) return { prompt, html: html || "", instruction, kind, recentPalettes, operation: "edit" as const };
  // Desktop gestionale/sito must not start from a phone seed or iPhone tabbar.
  if (!isPhoneKind(kind)) {
    return {
      prompt,
      html: html || "",
      instruction: "",
      kind,
      recentPalettes,
      operation: "create" as const,
    };
  }
  const composed = composeProduct(prompt, { recent: recentPalettes });
  return {
    prompt,
    html: composed.html,
    instruction: composed.polish,
    kind,
    recentPalettes,
    palette: composed.tokens.palette,
    operation: "create" as const,
  };
}
