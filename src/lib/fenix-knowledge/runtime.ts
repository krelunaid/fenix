import { catalogKnowledge } from "./catalog.ts";
import { assertCategoryComplete } from "./categories.ts";
import type { KnowledgeIndex } from "./types.ts";

let cached: KnowledgeIndex | null = null;

/** Runtime load used by compose — catalog only, no fs. */
export function loadKnowledge(): KnowledgeIndex {
  if (cached) return cached;
  const index = catalogKnowledge();
  assertCategoryComplete(index);
  cached = index;
  return cached;
}

export function resetKnowledgeCache(): void {
  cached = null;
}
