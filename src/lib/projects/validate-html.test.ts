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
  validatePublishable,
} from "./validate-html.ts";
import { fenixRuntimeScript, looksLikeSite, prepareSrcDoc } from "./color-scheme.ts";

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

describe("validatePublishable final srcdoc", () => {
  it("compiles the prepared srcdoc including runtime and guard", () => {
    const report = validatePublishable(VALID, { kind: "app", projectId: "fixture" });
    assert.equal(report.syntaxOk, true, report.errors.join(" · "));
    assert.equal(report.ok, true, report.errors.join(" · "));
    assert.match(report.srcDoc, /data-fenix-runtime/);
    assert.match(report.srcDoc, /data-officina-guard/);
    const scripts = extractInlineScripts(report.srcDoc);
    assert.ok(scripts.length >= 2);
    for (const script of scripts) {
      const syntax = checkScriptSyntax(script.code);
      assert.equal(syntax.ok, true, syntax.error);
    }
  });

  it("rejects a nested-quote icon selector as invalid JS", () => {
    const bad = `document.querySelector("link[rel='icon'], link[rel="icon"]")`;
    const syntax = checkScriptSyntax(bad);
    assert.equal(syntax.ok, false);
    assert.match(String(syntax.error), /missing \) after argument list|Unexpected token/i);
    assert.equal(checkScriptSyntax(`document.querySelector("link[rel=icon]")`).ok, true);
  });

  it("ships a runtime whose icon selector compiles", () => {
    const runtime = fenixRuntimeScript("p1");
    assert.match(runtime, /querySelector\("link\[rel=icon\]"\)/);
    assert.doesNotMatch(runtime, /rel=\\"icon\\"/);
    const code = runtime.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
    assert.equal(checkScriptSyntax(code).ok, true, checkScriptSyntax(code).error);
  });

  it("does not publish when the final srcdoc is syntactically invalid", () => {
    assert.equal(canPublishHtml(BROKEN, "app", "broken"), false);
  });
});

describe("looksLikeSite kind lock", () => {
  it("keeps dashboard/site on the desktop kit even if the HTML has data-view", () => {
    assert.equal(looksLikeSite(VALID, "dashboard"), true);
    assert.equal(looksLikeSite(VALID, "site"), true);
    assert.equal(looksLikeSite(VALID, "app"), false);
    const dash = prepareSrcDoc(VALID, "#ffffff", "dash", "dashboard");
    assert.match(dash, /data-fenix-site/);
    assert.doesNotMatch(dash, /data-fenix-phone/);
    const app = prepareSrcDoc(VALID, "#ffffff", "app", "app");
    assert.match(app, /data-fenix-phone/);
    assert.doesNotMatch(app, /data-fenix-site/);
  });

  it("gives the phone kit overflow-y scroll on main", () => {
    const app = prepareSrcDoc(VALID, "#ffffff", "app", "app");
    assert.match(app, /overflow-y:auto/);
    assert.match(app, /overflowY = "scroll"/);
  });

  it("gives site/dashboard documents page scroll", () => {
    const site = prepareSrcDoc(
      `<!DOCTYPE html><html><head></head><body><nav><a href="#a">a</a></nav><section></section><section></section><section></section><section></section><footer></footer></body></html>`,
      "#ffffff",
      "site",
      "site",
    );
    assert.match(site, /data-fenix-site/);
    assert.match(site, /overflow:auto!important/);
  });
});
