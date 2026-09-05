import assert from "node:assert/strict";
import { test } from "node:test";
import { applyVisualStylePlan, isComposedVisualArtifact } from "../workers/visual/visual-style.mjs";

const html = '<!doctype html><html data-grammar="agenda"><head><style data-fenix-craft>:root{--accent:#225566}</style></head><body><nav id="tabs"><button data-view="oggi">Oggi</button></nav><main id="root">$&</main><script>window.saved="$&";</script></body></html>';
const plan = { version: 1, rules: [{ selector: ".brand", declarations: { "font-size": "28px", "letter-spacing": "-0.02em" } }, { selector: ".card", viewport: "mobile", declarations: { padding: "16px 20px", "box-shadow": "subtle" } }] };

test("visual plan changes only its head style layer, preserving runtime and chosen palette", () => {
  assert.equal(isComposedVisualArtifact(html), true);
  const next = applyVisualStylePlan(html, plan);
  assert.equal(next.slice(next.indexOf("</head>")), html.slice(html.indexOf("</head>")));
  assert.ok(next.startsWith(html.slice(0, html.indexOf("</head>"))));
  assert.match(next, /@media \(max-width: 599px\)/);
  assert.throws(() => applyVisualStylePlan(next, plan), /invariato/);
  const revised = applyVisualStylePlan(next, { version: 1, rules: [{ selector: ".brand", declarations: { "font-size": "30px" } }] });
  assert.equal((revised.match(/data-fenix-visual-style=/g) || []).length, 1);
  assert.doesNotMatch(revised, /font-size:28px/);
});

test("visual plan rejects executable, hiding, palette-changing and unbounded declarations atomically", () => {
  for (const declarations of [
    { background: 'url(https://invalid.example/track)' },
    { color: '#777777' }, { display: 'none' }, { position: 'fixed' },
    { "font-size": '0px' }, { padding: '1000px' }, { "font-size": '16px;display:none' },
    { "box-shadow": '</style><script>alert(1)</script>' }, { "font-weight": 600 },
    { "font-family": 'serif' }, { content: '$&' }, { animation: 'spin 1s infinite' },
  ]) assert.throws(() => applyVisualStylePlan(html, { version: 1, rules: [{ selector: ".card", declarations }] }));
  for (const invalid of [null, {}, { version: 1, rules: [] }, { ...plan, html: '<p>rewrite</p>' },
    { version: 1, rules: [{ selector: '</style>', declarations: { padding: '16px' } }] },
    { version: 1, rules: [plan.rules[0], plan.rules[0]] },
  ]) assert.throws(() => applyVisualStylePlan(html, invalid));
  assert.throws(() => applyVisualStylePlan('<html><head></head><body>No contract</body></html>', plan));
});
