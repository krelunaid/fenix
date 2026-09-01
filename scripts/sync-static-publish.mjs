#!/usr/bin/env node
/**
 * Nitro writes hashed client assets to .output/public (node) or dist/client.
 * Netlify must publish THAT tree, never a leftover dist from a previous SHA.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function indexAssets(dir) {
  const assets = join(dir, "assets");
  if (!existsSync(assets)) return [];
  return readdirSync(assets).filter((n) => /^index-[\w-]+\.js$/.test(n));
}

export function resolvePublicDir(base = root) {
  const candidates = [
    process.env.FENIX_PUBLIC_DIR,
    join(base, ".output/public"),
    join(base, "dist/client"),
    join(base, "dist"),
  ].filter(Boolean);
  for (const dir of candidates) {
    if (indexAssets(dir).length) return dir;
  }
  throw new Error(
    "[build] missing hashed index-*.js in .output/public (and dist/client). Nitro did not emit public assets.",
  );
}

export function syncStaticPublish(from, to = from) {
  const src = from || resolvePublicDir();
  const names = indexAssets(src);
  if (!names.length) {
    throw new Error(`[build] ${src}/assets has no index-*.js`);
  }
  if (to && to !== src) {
    if (existsSync(to)) rmSync(to, { recursive: true, force: true });
    mkdirSync(to, { recursive: true });
    cpSync(src, to, { recursive: true });
  }
  let sha = process.env.COMMIT_REF || process.env.GITHUB_SHA || "";
  if (!sha) {
    try {
      sha = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      sha = "";
    }
  }
  const stamp = {
    sha: sha.slice(0, 40),
    assets: names,
    published: src.replace(root + "/", ""),
    at: new Date().toISOString(),
  };
  writeFileSync(join(src, "fenix-release.json"), JSON.stringify(stamp), "utf8");
  if (to && to !== src && existsSync(to)) {
    writeFileSync(join(to, "fenix-release.json"), JSON.stringify(stamp), "utf8");
  }
  return { from: src, to: to || src, files: names.length, assets: names, sha: stamp.sha };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const src = resolvePublicDir();
  const dest = process.env.FENIX_PUBLISH_DIR || join(root, ".output/public");
  const result = syncStaticPublish(src, dest);
  console.log(
    `[build] publish ${result.to} assets=${result.assets.join(",")} sha=${result.sha || "local"}`,
  );
}
