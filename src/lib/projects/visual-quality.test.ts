import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { DEMOS } from "./demos.ts";
import { auditCraft, contrastRatio } from "./visual-quality.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fingerprint = JSON.parse(
  readFileSync(join(here, "fixtures/visual-fingerprint.json"), "utf8"),
) as {
  identities: Record<string, { bg: string; fg: string; accent: string; fontHint: string }>;
};

describe("auditCraft fixtures", () => {
  it("rejects the generic iOS SaaS pair", () => {
    const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500" rel="stylesheet"/><style>:root{--bg:#f5f5f7;--fg:#1d1d1f;--accent:#0071e3}</style></head><body></body></html>`;
    const report = auditCraft(html, { bg: "#f5f5f7", fg: "#1d1d1f" });
    assert.equal(report.ok, false);
    assert.equal(report.genericFont, true);
    assert.equal(report.genericIosGray, true);
    assert.equal(report.genericIosBlue, true);
  });

  it("keeps a distinct identity and AA contrast on every demo", () => {
    const bgs = new Set<string>();
    const fonts = new Set<string>();
    for (const [id, demo] of Object.entries(DEMOS)) {
      const expected = fingerprint.identities[id];
      assert.ok(expected, `missing fingerprint for ${id}`);
      const report = auditCraft(demo.html, demo.palette);
      assert.equal(demo.palette.bg, expected.bg, id);
      assert.equal(demo.palette.fg, expected.fg, id);
      assert.equal(demo.palette.accent, expected.accent, id);
      assert.match(demo.html, new RegExp(expected.fontHint), `${id} font`);
      assert.equal(report.genericFont, false, `${id}: ${report.notes.join(" · ")}`);
      assert.equal(report.ok, true, `${id}: ${report.notes.join(" · ")}`);
      assert.ok(report.contrast >= 4.5, `${id} contrast ${report.contrast}`);
      assert.doesNotMatch(demo.html, /\bManrope\b|#f5f5f7|#0071e3|unsplash|localStorage/);
      assert.match(
        demo.html,
        /data-fenix-ready/,
        `${id} must mark ready after hydration`,
      );
      assert.match(demo.html, /function markReady\(/, `${id} markReady helper`);
      bgs.add(demo.palette.bg.toLowerCase());
      fonts.add(expected.fontHint);
    }
    assert.equal(bgs.size, Object.keys(DEMOS).length, "each demo needs its own ground");
    assert.equal(fonts.size, Object.keys(fingerprint.identities).length);
  });

  it("measures AA on the four craft landings", () => {
    for (const id of ["grottaglie", "catenaria", "corvo", "kiln"] as const) {
      const demo = DEMOS[id];
      assert.ok(contrastRatio(demo.palette.fg, demo.palette.bg) >= 4.5, id);
      assert.equal(auditCraft(demo.html, demo.palette).ok, true, id);
    }
  });
});
