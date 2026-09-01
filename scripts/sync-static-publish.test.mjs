import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { syncStaticPublish } from "./sync-static-publish.mjs";

describe("sync-static-publish", () => {
  it("copies .output/public index hash into dist/assets", () => {
    const root = mkdtempSync(join(tmpdir(), "fenix-sync-"));
    const from = join(root, "public");
    const to = join(root, "dist");
    mkdirSync(join(from, "assets"), { recursive: true });
    writeFileSync(join(from, "index.html"), "<html>fenix</html>");
    writeFileSync(join(from, "assets", "index-TestHash1.js"), "console.log('phase2')");
    const result = syncStaticPublish(from, to);
    assert.equal(result.files >= 1, true);
    assert.equal(readFileSync(join(to, "assets", "index-TestHash1.js"), "utf8"), "console.log('phase2')");
    assert.equal(readFileSync(join(to, "index.html"), "utf8"), "<html>fenix</html>");
  });
});
