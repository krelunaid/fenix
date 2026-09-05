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
import { fenixRuntimeScript, looksLikeSite, prepareSrcDoc, sanitizePreviewHtml, escapeEmbeddedScriptEnds, looksLikeLeakedCss, repairLeakedCss, resolvePalette, paletteHueConflict } from "./color-scheme.ts";
import { DEMOS } from "./demos.ts";
import { APP_SHELL_HTML } from "../ai/app-shell.ts";
import { familyFromBrief } from "./design-tokens.ts";
import { grammarFromBrief } from "./layout-grammar.ts";

const here = dirname(fileURLToPath(import.meta.url));
const BROKEN = readFileSync(join(here, "fixtures/broken-flusso.html"), "utf8");
const VALID = readFileSync(join(here, "fixtures/valid-app.html"), "utf8");
const BOTTEGA = readFileSync(join(here, "fixtures/bottega-orders-crash.html"), "utf8");
const NULL_INNER = readFileSync(join(here, "fixtures/null-innerhtml.html"), "utf8");
const NULL_FIXED = readFileSync(join(here, "fixtures/null-innerhtml-fixed.html"), "utf8");
const LEAKED_CSS = readFileSync(join(here, "fixtures/leaked-phone-css.html"), "utf8");
const GENERIC_LEAKED_CSS = `<!DOCTYPE html><html><head><title>Sentinel</title></head><body>
<header><h1>Sentinel</h1></header><main>
.app-shell{display:flex;flex-direction:column;min-height:100dvh}
.bottom-nav{height:64px;background:#111827;color:#f8fafc}
button.primary{padding:12px 16px;border-radius:8px}
</main><nav class="bottom-nav"><button>Panoramica</button></nav>
<script>window.Fenix.load("state");window.Fenix.save("state",{});</script></body></html>`;

describe("validateProductHtml", () => {
  it("recognizes appointment businesses without requiring the word appuntamenti", () => {
    for (const brief of ["app per parrucchieri", "Barber shop", "barbiere", "barbieri", "hair salon"]) {
      assert.equal(familyFromBrief(brief), "booking", brief);
      assert.equal(grammarFromBrief(`FORMATO: app. kind=app. ${brief}`).id,"agenda",brief);
    }
    assert.notEqual(familyFromBrief("app per barbecue"), "booking");
  });
  it("locates unexpected tokens and unterminated strings without executing or leaking source", () => {
    const cases = [
      ["\n\nconst label = 'Barber\nshop';", 3, 15],
      ["\nconst label = \\u{INVALID};", 2, 18],
      ["\nconst icon = '<svg class='mark'></svg>';", 2, 27],
    ] as const;
    for (const [source, line, column] of cases) {
      const report = checkScriptSyntax(source);
      assert.equal(report.ok, false);
      assert.equal(report.line, line, source);
      assert.equal(report.column, column, source);
      assert.ok(!report.error?.includes(source));
    }
    const sentinel = "__fenix_compile_only_sentinel";
    assert.equal(checkScriptSyntax(`globalThis.${sentinel} = true;`).ok, true);
    assert.equal(Object.hasOwn(globalThis, sentinel), false);
    assert.equal(checkScriptSyntax("\nreturn 'valid function body';").ok, true);
  });
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
    assert.match(fenixRuntimeScript("p", "site"), /var unwrapBoxes = true/);
    assert.match(fenixRuntimeScript("p", "dashboard"), /var unwrapBoxes = false/);
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

  it("sizes kit tab columns from the real tab count, default 5, not a global 4", () => {
    const kitSrc = readFileSync(join(here, "color-scheme.ts"), "utf8");
    assert.match(kitSrc, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
    assert.doesNotMatch(kitSrc, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
    const tabs = (n: number) =>
      Array.from({ length: n }, (_, i) => `<button type="button" data-view="v${i}"><span>T${i}</span></button>`).join("");
    const doc = (n: number) =>
      `<!DOCTYPE html><html><head></head><body><main><p>x</p></main><nav class="fk-tab" aria-label="Navigazione">${tabs(n)}</nav></body></html>`;
    const five = prepareSrcDoc(doc(5), "#efe6d4", "five-tabs", "app");
    assert.doesNotMatch(doc(5), /data-fenix-phone/);
    assert.match(five, /data-fenix-phone/);
    assert.match(five, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
    const four = prepareSrcDoc(doc(4), "#efe6d4", "four-tabs", "app");
    assert.match(four, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
    const three = prepareSrcDoc(doc(3), "#efe6d4", "three-tabs", "app");
    assert.match(three, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
    const none = prepareSrcDoc(
      `<!DOCTYPE html><html><head></head><body><main><p>x</p></main></body></html>`,
      "#efe6d4",
      "no-tabs",
      "app",
    );
    assert.match(none, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
    const stamped = prepareSrcDoc(
      `<!DOCTYPE html><html><head><style data-fenix-phone>.x{}</style></head><body><nav class="fk-tab">${tabs(5)}</nav></body></html>`,
      "#efe6d4",
      "already-stamped",
      "app",
    );
    assert.doesNotMatch(stamped, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
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
    assert.doesNotMatch(src, /--bg:#111827/);
    assert.doesNotMatch(src, /--accent:#2dd4bf/);
    assert.match(src, /--line:/);
    assert.match(src, /--btn:/);
    assert.match(src, /--btn-ink:/);
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
    assert.match(src, /--bg:#1a1612/);
    assert.match(src, /--fg:#efe6d4/);
    assert.doesNotMatch(src, /--bg:#111827/);
  });

  it("keeps explicit warm-dark palettes instead of swapping navy/teal", () => {
    const perfume = resolvePalette({
      bg: "#120e0c",
      surface: "#1d1714",
      fg: "#f4ead8",
      muted: "#b7a48c",
      accent: "#c4a15a",
      line: "#3a3028",
    });
    assert.equal(perfume.bg.toLowerCase(), "#120e0c");
    assert.equal(perfume.accent.toLowerCase(), "#c4a15a");
    assert.equal(paletteHueConflict(perfume), true);
    const kitchen = resolvePalette({
      bg: "#1a1210",
      surface: "#241816",
      fg: "#f6ead8",
      muted: "#c4a890",
      accent: "#c43c2c",
      line: "#4a3028",
    });
    assert.equal(kitchen.bg.toLowerCase(), "#1a1210");
    assert.equal(kitchen.accent.toLowerCase(), "#c43c2c");
    const src = prepareSrcDoc(
      `<!DOCTYPE html><html data-family="perfume"><head></head><body><main><p>oro</p></main></body></html>`,
      perfume,
      "essenza-keep",
      "app",
    );
    assert.match(src, /--bg:#120e0c/);
    assert.match(src, /--accent:#c4a15a/);
    assert.match(src, /data-fenix-hue-conflict="warm"/);
    assert.doesNotMatch(src, /--bg:#111827/);
    assert.doesNotMatch(src, /--accent:#2dd4bf/);
  });
});

describe("leaked phone-kit CSS", () => {
  it("detects a dump in <main> and never publishes the unrepaired source", () => {
    assert.equal(looksLikeLeakedCss(LEAKED_CSS), true);
    assert.equal(looksLikeLeakedCss(VALID), false);
    for (const demo of Object.values(DEMOS)) {
      assert.equal(looksLikeLeakedCss(demo.html), false, demo.id);
    }
    const report = validateProductHtml(LEAKED_CSS, { kind: "app" });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /CSS tecnico visibile/i.test(e)), report.errors.join(" · "));
    assert.equal(canPublishHtml(LEAKED_CSS, "app", "orto-vivo"), false);
    const pub = validatePublishable(LEAKED_CSS, { kind: "app", projectId: "orto-vivo" });
    assert.equal(pub.ok, false);
    assert.ok(pub.errors.some((e) => /CSS tecnico visibile/i.test(e)));
    assert.match(pub.srcDoc, /data-fenix-rescued/);
    assert.doesNotMatch(pub.srcDoc.replace(/<style\b[\s\S]*?<\/style>/gi, " "), /\.fk-hello\s*\{/);
    assert.doesNotMatch(pub.srcDoc.replace(/<style\b[\s\S]*?<\/style>/gi, " "), /\.fk-tab\s*\{/);
  });

  it("moves the dump into <style data-fenix-rescued> so the source is clean", () => {
    const fixed = repairLeakedCss(LEAKED_CSS);
    assert.equal(looksLikeLeakedCss(fixed), false, "repaired source still looks leaked");
    assert.match(fixed, /data-fenix-rescued/);
    assert.match(fixed, /\.fk-hello\{/);
    assert.match(fixed, /\.fk-tab,/);
    assert.match(fixed, /\.fk-sheet\{/);
    const markup = fixed.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ");
    assert.doesNotMatch(markup, /\.fk-hello\s*\{/);
    assert.doesNotMatch(markup, /\.fk-tab\s*\{/);
    assert.doesNotMatch(markup, /\.fk-sheet\s*\{/);
    assert.equal(canPublishHtml(fixed, "app", "orto-vivo"), true, validatePublishable(fixed, { kind: "app" }).errors.join(" · "));
  });

  it("blocks and repairs generic CSS text, not only known .fk-* selectors", () => {
    assert.equal(looksLikeLeakedCss(GENERIC_LEAKED_CSS), true);
    const report = validateProductHtml(GENERIC_LEAKED_CSS, { kind: "app" });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /CSS tecnico visibile/i.test(e)));
    const fixed = repairLeakedCss(GENERIC_LEAKED_CSS);
    assert.equal(looksLikeLeakedCss(fixed), false);
    assert.match(fixed, /data-fenix-rescued/);
    const markup = fixed
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ");
    assert.doesNotMatch(markup, /\.app-shell\s*\{/);
    assert.doesNotMatch(markup, /\.bottom-nav\s*\{/);
  });

  it("unescapes encoded style tags so the CSS is no longer visible text", () => {
    const lt = "\u0026lt;";
    const gt = "\u0026gt;";
    const escaped = LEAKED_CSS.replace(
      /<main\b([^>]*)>([\s\S]*?)<\/main>/i,
      (_all, attrs: string, inner: string) =>
        `<main${attrs}>${lt}style${gt}${inner}${lt}/style${gt}</main>`,
    );
    assert.equal(looksLikeLeakedCss(escaped), true);
    assert.equal(canPublishHtml(escaped, "app", "orto-escaped"), false);
    const fixed = repairLeakedCss(escaped);
    assert.equal(looksLikeLeakedCss(fixed), false);
    assert.match(fixed, /<style/i);
    assert.doesNotMatch(fixed, /\u0026lt;style/i);
    const markup = fixed.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ");
    assert.doesNotMatch(markup, /\.fk-hello\s*\{/);
  });
});
