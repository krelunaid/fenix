import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  canPublishHtml,
  checkScriptSyntax,
  extractInlineScripts,
  looksLikeGestionaleOnSite,
  validateProductHtml,
  validatePublishable,
} from "./validate-html.ts";
import { fenixRuntimeScript, looksLikeSite, prepareSrcDoc, sanitizePreviewHtml, escapeEmbeddedScriptEnds } from "./color-scheme.ts";
import { DEMOS } from "./demos.ts";
import { APP_SHELL_HTML } from "../ai/app-shell.ts";

const here = dirname(fileURLToPath(import.meta.url));
const BROKEN = readFileSync(join(here, "fixtures/broken-flusso.html"), "utf8");
const VALID = readFileSync(join(here, "fixtures/valid-app.html"), "utf8");
const BOTTEGA = readFileSync(join(here, "fixtures/bottega-orders-crash.html"), "utf8");
const NULL_INNER = readFileSync(join(here, "fixtures/null-innerhtml.html"), "utf8");
const NULL_FIXED = readFileSync(join(here, "fixtures/null-innerhtml-fixed.html"), "utf8");

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

  it("accepts every demo as publishable Fenix storage, never localStorage", () => {
    for (const demo of Object.values(DEMOS)) {
      const own = demo.html.replace(/<script data-fenix-runtime[\s\S]*?<\/script>/gi, "");
      assert.doesNotMatch(own, /\blocalStorage\b/, demo.id);
      assert.doesNotMatch(demo.html, /unsplash/i, demo.id);
      const report = validateProductHtml(demo.html, { kind: demo.kind });
      assert.equal(report.ok, true, `${demo.id}: ${report.errors.join(" · ")}`);
      assert.equal(canPublishHtml(demo.html, demo.kind, demo.id), true, demo.id);
    }
  });

  it("rejects a phone fk-tab shell on dashboard and still publishes kiln", () => {
    const phone = validateProductHtml(APP_SHELL_HTML, { kind: "dashboard" });
    assert.equal(phone.ok, false);
    assert.ok(phone.errors.some((e) => /tabbar telefono/i.test(e)));
    const kiln = validateProductHtml(DEMOS.kiln.html, { kind: "dashboard" });
    assert.equal(kiln.ok, true, kiln.errors.join(" · "));
  });

  it("rejects a site brief that ships gestionale .orders scaffold", () => {
    assert.equal(looksLikeGestionaleOnSite(BOTTEGA, "site"), true);
    assert.equal(looksLikeGestionaleOnSite(BOTTEGA, "dashboard"), false);
    const asSite = validateProductHtml(BOTTEGA, { kind: "site" });
    assert.equal(asSite.syntaxOk, true, asSite.errors.join(" · "));
    assert.equal(asSite.ok, false);
    assert.ok(asSite.errors.some((e) => /gestionale|orders/i.test(e)));
    assert.equal(canPublishHtml(BOTTEGA, "site", "bottega"), false);
    const asDash = validateProductHtml(BOTTEGA, { kind: "dashboard" });
    assert.equal(asDash.ok, true, asDash.errors.join(" · "));
  });

  it("null querySelector.innerHTML still compiles, repaired sibling is complete", () => {
    const crash = validateProductHtml(NULL_INNER, { kind: "dashboard" });
    assert.equal(crash.syntaxOk, true, crash.errors.join(" · "));
    assert.equal(crash.ok, true, crash.errors.join(" · "));
    const fixed = validateProductHtml(NULL_FIXED, { kind: "dashboard" });
    assert.equal(fixed.syntaxOk, true, fixed.errors.join(" · "));
    assert.equal(fixed.ok, true, fixed.errors.join(" · "));
    assert.match(fenixRuntimeScript("p", "site"), /var desk = true/);
    assert.match(fenixRuntimeScript("p", "landing"), /var desk = true/);
    assert.match(fenixRuntimeScript("p", "dashboard"), /var desk = true/);
    assert.match(fenixRuntimeScript("p", "app"), /var desk = false/);
    assert.match(fenixRuntimeScript("p"), /var desk = false/);
    assert.match(fenixRuntimeScript("p", "site"), /if \(desk\) return;/);
    assert.match(fenixRuntimeScript("p", "site"), /unwrapLoad/);
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

  it("escapes </script> inside JS strings so srcdoc does not SyntaxError", () => {
    const poisoned = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"/><title>X</title></head><body>
<nav><button data-view="a">A</button><button data-view="b">B</button><button data-view="c">C</button></nav>
<script>
  var a = "<script>foo(</script>";
  var b = "<script>bar(</script>";
  var c = "<script>baz(</script>";
  window.Fenix = { load: function(){ return Promise.resolve([]); }, save: function(){ return Promise.resolve(); } };
  document.documentElement.setAttribute("data-fenix-ready","1");
</script>
</body></html>`;
    const rawScripts = extractInlineScripts(poisoned);
    assert.ok(rawScripts.some((s) => !checkScriptSyntax(s.code).ok), "fixture must split without escape");
    const escaped = escapeEmbeddedScriptEnds(poisoned);
    assert.match(escaped, /<\\\/script/);
    const scripts = extractInlineScripts(escaped);
    assert.ok(scripts.length >= 1);
    for (const script of scripts) {
      const syntax = checkScriptSyntax(script.code);
      assert.equal(syntax.ok, true, syntax.error);
    }
    const src = prepareSrcDoc(poisoned, "#ffffff", "poison", "dashboard");
    for (const script of extractInlineScripts(src)) {
      const syntax = checkScriptSyntax(script.code);
      assert.equal(syntax.ok, true, syntax.error);
    }
  });

  it("does not publish when the final srcdoc is syntactically invalid", () => {
    assert.equal(canPublishHtml(BROKEN, "app", "broken"), false);
  });

  it("keeps SVG self-closing attributes instead of stripping leaked quotes", () => {
    const svg = `<circle cx="16" cy="16" r="9" stroke-width="2.2"/><path d="M1 1"/>`;
    const kept = sanitizePreviewHtml(`<body>${svg}</body>`);
    assert.match(kept, /stroke-width="2.2"\/>/);
    assert.match(kept, /d="M1 1"\/>/);
    const leaked = sanitizePreviewHtml(`<body>\n" />\n<main>ok</main></body>`);
    assert.doesNotMatch(leaked, /^\s*"\s*\/>/m);
    assert.match(leaked, /<main>ok<\/main>/);
  });
});

describe("looksLikeSite kind lock", () => {
  it("keeps dashboard/site on the desktop kit even if the HTML has data-view", () => {
    assert.equal(looksLikeSite(VALID, "dashboard"), true);
    assert.equal(looksLikeSite(VALID, "site"), true);
    assert.equal(looksLikeSite(VALID, "app"), false);
    const dash = prepareSrcDoc(VALID, "#ffffff", "dash", "dashboard");
    assert.match(dash, /data-fenix-desk/);
    assert.doesNotMatch(dash, /max-width:40rem/);
    assert.doesNotMatch(dash, /data-fenix-phone/);
    const app = prepareSrcDoc(VALID, "#ffffff", "app", "app");
    assert.match(app, /data-fenix-phone/);
    assert.doesNotMatch(app, /data-fenix-site/);
    const site = prepareSrcDoc(
      `<!DOCTYPE html><html><head></head><body><nav><a href="#a">a</a></nav><section></section><section></section><section></section><section></section><footer></footer></body></html>`,
      "#ffffff",
      "site-kit",
      "site",
    );
    assert.match(site, /data-fenix-site/);
    assert.match(site, /data-fenix-desk/);
    assert.match(site, /max-width:1120px/);
    assert.doesNotMatch(site, /max-width:40rem/);
    assert.doesNotMatch(site, /data-fenix-phone/);
    assert.match(site, /nav\.bottom-tab,nav\.fk-tab\{display:none!important\}/);
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

  it("injects the full palette so the phone kit does not paint dark ink on dark paper", () => {
    const src = prepareSrcDoc(
      DEMOS.catenaria.html,
      DEMOS.catenaria.palette,
      "catenaria",
      DEMOS.catenaria.kind,
    );
    assert.match(src, /data-fenix-palette/);
    assert.match(src, /--bg:#1a1612/);
    assert.match(src, /--surface:#2a241c/);
    assert.match(src, /--fg:#e6dcc8/);
    assert.match(src, /--muted:#9a8f7a/);
    assert.match(src, /--accent:#c45c26/);
    assert.match(src, /--line:/);
    const lastRoot = [...src.matchAll(/:root\{([^}]+)\}/g)].at(-1)?.[1] ?? "";
    assert.match(lastRoot, /--fg:#e6dcc8/);
  });

  it("infers light ink when only a dark bg is passed", () => {
    const src = prepareSrcDoc(
      `<!DOCTYPE html><html><head></head><body><main><p>x</p></main></body></html>`,
      "#1a1612",
      "dark-only",
      "app",
    );
    assert.match(src, /data-fenix-palette/);
    assert.match(src, /--fg:#efe6d4/);
    assert.match(src, /--bg:#1a1612/);
  });
});
