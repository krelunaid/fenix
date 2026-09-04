import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  auditCraftPhoto,
  BANNED_CRAFT_SHA256,
  CRAFT_GALLERY_FILES,
  CRAFT_HERO_FILE,
  CRAFT_PHOTO_FILES,
  looksLikeUiScreenshot,
} from "./craft-assets.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("craft photo gate", () => {
  it("rejects the known Fenix phone screenshot hash and portrait UI samples", () => {
    assert.equal(BANNED_CRAFT_SHA256.includes("192e6400aa6709b3768fb05ff375ea3b8d28ef3a1a1a56ecf18dd6aacdf0cf0a"), true);
    const navy = Buffer.alloc(48 * 48 * 3);
    for (let i = 0; i < 48 * 48; i++) {
      navy[i * 3] = 7;
      navy[i * 3 + 1] = 4;
      navy[i * 3 + 2] = 26;
    }
    assert.equal(looksLikeUiScreenshot(navy), true);
  });

  it("accepts landscape ceramic stills and rejects a duplicate hero", () => {
    const hashes = new Set<string>();
    for (const file of CRAFT_PHOTO_FILES) {
      const path = join(root, "public", file);
      assert.equal(existsSync(path), true, file);
      const report = auditCraftPhoto(path, file);
      assert.equal(report.ok, true, `${file}: ${report.notes.join(" · ")}`);
      assert.equal(BANNED_CRAFT_SHA256.includes(report.sha256), false, file);
      hashes.add(report.sha256);
      if (file === CRAFT_HERO_FILE) {
        assert.ok(Math.abs(report.ratio - 16 / 9) < 0.08, `hero ratio ${report.ratio}`);
      }
    }
    assert.equal(hashes.size, CRAFT_PHOTO_FILES.length);
    assert.equal(CRAFT_GALLERY_FILES.length, 5);
    const hero = readFileSync(join(root, "public", CRAFT_HERO_FILE));
    assert.notEqual(createHash("sha256").update(hero).digest("hex"), BANNED_CRAFT_SHA256[0]);
  });
});
