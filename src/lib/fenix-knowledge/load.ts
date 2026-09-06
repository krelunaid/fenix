/**
 * Node-only disk loader. Tests use this to prove fenix-knowledge/ JSON parses.
 * Compose uses `loadKnowledge()` from runtime.ts (no fs).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertCategoryComplete } from "./categories.ts";
import {
  KNOWLEDGE_CATEGORIES,
  type KnowledgeIndex,
  type KnowledgePack,
} from "./types.ts";

export function knowledgeRoot(from = fileURLToPath(import.meta.url)): string {
  let dir = dirname(from);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, "fenix-knowledge", "categories.json"))) {
      return join(dir, "fenix-knowledge");
    }
    dir = dirname(dir);
  }
  throw new Error("fenix-knowledge/ not found from " + from);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function packFiles(categoryDir: string): string[] {
  if (!existsSync(categoryDir)) return [];
  return readdirSync(categoryDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => join(categoryDir, name))
    .sort();
}

export function loadKnowledgeFromDisk(root = knowledgeRoot()): KnowledgeIndex {
  const meta = readJson<{
    version: number;
    extractNotClone: boolean;
    completenessRetryThreshold: number;
    categories: KnowledgeIndex["categories"];
  }>(join(root, "categories.json"));
  const packs: KnowledgePack[] = [];
  for (const id of KNOWLEDGE_CATEGORIES) {
    for (const file of packFiles(join(root, id))) {
      const pack = readJson<KnowledgePack>(file);
      if (pack.category !== id) {
        throw new Error(`${file}: category ${pack.category} != folder ${id}`);
      }
      packs.push(pack);
    }
  }
  const index: KnowledgeIndex = {
    version: meta.version,
    extractNotClone: true,
    completenessRetryThreshold: meta.completenessRetryThreshold,
    categories: meta.categories,
    packs,
  };
  assertCategoryComplete(index);
  return index;
}
