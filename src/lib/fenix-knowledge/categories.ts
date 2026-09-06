import { KNOWLEDGE_CATEGORIES, type KnowledgeCategory, type KnowledgeIndex } from "./types.ts";

export function assertCategoryComplete(index: KnowledgeIndex): void {
  const ids = new Set(index.categories.map((c) => c.id));
  for (const id of KNOWLEDGE_CATEGORIES) {
    if (!ids.has(id as KnowledgeCategory)) {
      throw new Error(`missing knowledge category: ${id}`);
    }
  }
}
