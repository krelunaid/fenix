import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  canPublishHtml,
  checkScriptSyntax,
  extractInlineScripts,
  validateProductHtml,
} from "./validate-html.ts";

const here = dirname(fileURLToPath(import.meta.url));
const BROKEN = readFileSync(join(here, "fixtures/broken-flusso.html"), "utf8");
const VALID = readFileSync(join(here, "fixtures/valid-app.html"), "utf8");

describe("validateProductHtml", () => {
  it("extracts inline scripts and reports the exact syntax error", () => {
    const scripts = extractInlineScripts(BROKEN);
    assert.equal(scripts.length, 1);
    const syntax = checkScriptSyntax(scripts[0].code);
    assert.equal(syntax.ok, false);
    assert.match(String(syntax.error), /missing \) after argument list|Unexpected token/i);
  });

  it("rejects leaked template literals and never allows publish", () => {
    const report = validateProductHtml(BROKEN, { kind: "app" });
    assert.equal(report.syntaxOk, false);
    assert.equal(report.ok, false);
    assert.equal(canPublishHtml(BROKEN, "app"), false);
    assert.ok(report.errors.some((e) => /sintassi JS|Script/i.test(e)));
    assert.ok(report.errors.some((e) => /Template literal/i.test(e)));
  });

  it("accepts a complete app with 3 views and Fenix storage", () => {
    const report = validateProductHtml(VALID, { kind: "app" });
    assert.deepEqual(report.scriptErrors, []);
    assert.equal(report.syntaxOk, true);
    assert.equal(report.ok, true, report.errors.join(" · "));
    assert.equal(canPublishHtml(VALID, "app"), true);
  });

  it("rejects localStorage in product scripts", () => {
    const html = VALID.replace(
      "window.Fenix.load",
      'localStorage.setItem("x", "1"); window.Fenix.load',
    );
    const report = validateProductHtml(html, { kind: "app" });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /localStorage/i.test(e)));
  });
});
