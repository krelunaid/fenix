import assert from "node:assert/strict";
import { test } from "node:test";
import { previewPrefix, rewritePreviewCss, rewritePreviewHtml } from "../src/lib/agent/preview-rewrite.ts";

const P = previewPrefix("job-1");

test("root-absolute attributes, srcset and inline css are prefixed; protocol-relative and external stay", () => {
  const html = `<!doctype html><html><head><link rel="stylesheet" href="/styles.css"><style>body{background:url(/bg.png) url("/x.svg")}</style></head>
<body><a href="/clienti">Clienti</a><a href="https://kreluna.it/">ext</a><img src="//cdn.example/a.png" srcset="/a.png 1x, /b.png 2x"><form action="/api/x"></form><script type="module" src="/app.js"></script></body></html>`;
  const out = rewritePreviewHtml(html, P);
  assert.match(out, new RegExp(`href="${P}/styles.css"`));
  assert.match(out, new RegExp(`href="${P}/clienti"`));
  assert.match(out, /href="https:\/\/kreluna\.it\/"/);
  assert.match(out, /src="\/\/cdn\.example\/a\.png"/);
  assert.match(out, new RegExp(`srcset="${P}/a.png 1x, ${P}/b.png 2x"`));
  assert.match(out, new RegExp(`action="${P}/api/x"`));
  assert.match(out, new RegExp(`src="${P}/app.js"`));
  assert.match(out, new RegExp(`url\\(${P}/bg.png\\)`));
  assert.match(out, new RegExp(`url\\("${P}/x.svg"\\)`));
  assert.match(out, /<head><script data-fenix-preview>/);
  assert.ok(out.includes(JSON.stringify(P)), "shim carries the prefix");
});

test("css files get url() rewritten; idempotent on already-prefixed paths", () => {
  const css = `.a{background:url(/img/a.png)} .b{background:url("${P}/img/b.png")}`;
  const out = rewritePreviewCss(css, P);
  assert.match(out, new RegExp(`url\\(${P}/img/a.png\\)`));
  assert.equal((out.match(new RegExp(P.replace(/[/.]/g, "\\$&"), "g")) || []).length, 2);
  const twice = rewritePreviewHtml(rewritePreviewHtml("<html><head></head><a href=\"/x\"></html>", P), P);
  assert.equal(twice.match(/data-fenix-preview/g).length, 1, "shim once");
  assert.equal((twice.match(/href="[^"]*"/g) || [])[0], `href="${P}/x"`, "no double prefix");
});
