import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(root, ".output");
const pgliteEntry = fileURLToPath(import.meta.resolve("@electric-sql/pglite"));
const pgliteDist = dirname(pgliteEntry);
const assets = ["pglite.data", "pglite.wasm", "initdb.wasm"];

async function findBundledPgliteDirs(dir) {
  const found = new Set();
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return found;
    throw error;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const child of await findBundledPgliteDirs(path)) found.add(child);
      continue;
    }
    if (
      entry.name.includes("electric-sql__pglite") &&
      [".js", ".mjs", ".cjs"].includes(extname(entry.name))
    ) {
      found.add(dir);
    }
  }
  return found;
}

const targets = await findBundledPgliteDirs(outputRoot);
for (const target of targets) {
  await mkdir(target, { recursive: true });
  for (const asset of assets) {
    await copyFile(join(pgliteDist, asset), join(target, asset));
  }
}

if (targets.size) {
  console.log(`[build] Copied PGLite sidecars into ${targets.size} bundle director${targets.size === 1 ? "y" : "ies"}.`);
}
