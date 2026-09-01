import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { resolvePublicDir, syncStaticPublish } from "./sync-static-publish.mjs";

describe("sync-static-publish", () => {
  it("picks the tree that has this SHA's index-*.js and stamps fenix-release.json", () => {
    const root = mkdtempSync(join(tmpdir(), "fenix-sync-"));
    const from = join(root, ".output/public");
    mkdirSync(join(from, "assets"), { recursive: true });
    writeFileSync(join(from, "assets", "index-Bm0nLqD1.js"), "console.log('phase2')");
    writeFileSync(join(from, "index.html"), '<script src="/assets/index-Bm0nLqD1.js">');
    const stale = join(root, "dist");
    mkdirSync(join(stale, "assets"), { recursive: true });
    writeFileSync(join(stale, "assets", "index-CGx-eZSZ.js"), "old");
    writeFileSync(join(stale, "index.html"), '<script src="/assets/index-CGx-eZSZ.js">');
    process.env.FENIX_PUBLIC_DIR = from;
    const resolved = resolvePublicDir(root);
    assert.equal(resolved, from);
    const result = syncStaticPublish(from, from);
    assert.deepEqual(result.assets, ["index-Bm0nLqD1.js"]);
    const stamp = JSON.parse(readFileSync(join(from, "fenix-release.json"), "utf8"));
    assert.deepEqual(stamp.assets, ["index-Bm0nLqD1.js"]);
    delete process.env.FENIX_PUBLIC_DIR;
  });

  it("refuses a dest that would keep a stale dist hash", () => {
    const root = mkdtempSync(join(tmpdir(), "fenix-sync2-"));
    const from = join(root, "public");
    mkdirSync(join(from, "assets"), { recursive: true });
    writeFileSync(join(from, "assets", "index-NewHash99.js"), "new");
    const to = join(root, "dist");
    const result = syncStaticPublish(from, to);
    assert.equal(readFileSync(join(to, "assets", "index-NewHash99.js"), "utf8"), "new");
    assert.equal(result.assets.includes("index-NewHash99.js"), true);
  });
});
