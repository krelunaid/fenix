import { composeProduct } from "./compose-product.ts";
import { isPhoneKind } from "../projects/infer.ts";
import type { ProjectKind } from "../projects/types.ts";
import type { TokenOptions } from "../projects/design-tokens.ts";

/** Once this request reaches the worker, do not retry it as a full-document build. */
export function isComposedCreation(body: { operation?: string; kind?: string }): boolean {
  return body.operation === "create" && isPhoneKind(body.kind);
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
  const composed = composeProduct(prompt, { recent: recentPalettes });
  return {
    prompt,
    html: composed.spec || isPhoneKind(kind) ? composed.html : html || "",
    instruction: composed.polish,
    kind,
    recentPalettes,
    palette: composed.tokens.palette,
    operation: "create" as const,
  };
}
