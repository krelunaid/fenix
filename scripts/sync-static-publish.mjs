#!/usr/bin/env node
/**
 * Nitro writes the client to .output/public. Netlify publish = dist.
 * Copy so production HTML references this SHA's hashed assets, not a stale dist.
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = process.env.FENIX_PUBLIC_DIR || join(root, ".output/public");
const dest = process.env.FENIX_PUBLISH_DIR || join(root, "dist");

export function syncStaticPublish(from = src, to = dest) {
  if (!existsSync(from)) {
    throw new Error(`[build] missing ${from} — vite/nitro did not emit public assets`);
  }
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  const assets = join(to, "assets");
  if (!existsSync(assets)) {
    throw new Error("[build] dist/assets missing after sync");
  }
  const names = readdirSync(assets);
  if (!names.some((n) => /^index-[\w-]+\.js$/.test(n))) {
    throw new Error("[build] dist/assets has no index-*.js after sync");
  }
  return { from, to, files: names.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = syncStaticPublish();
  console.log(`[build] synced ${result.from} → ${result.to} (${result.files} assets)`);
}
