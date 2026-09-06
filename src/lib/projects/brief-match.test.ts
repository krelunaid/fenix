import assert from "node:assert/strict";
import { test } from "node:test";
import { composeProduct } from "../ai/compose-product.ts";
import { genericBriefMismatch } from "./brief-match.ts";
import { auditGraphicQuality } from "./graphic-quality.ts";
import { crispAppMarkSvg } from "./premium-mark.ts";
import { fenixReviewer } from "../fenix-knowledge/reviewer.ts";

test("the reported videogames request cannot pass as the Note seed", () => {
  const brief = "FORMATO: app telefono 390×844.\nkind=app. Tab in basso, 5 schermate.\nNON un sito.\n\nmi crei un app di videogiochi";
  const result = composeProduct("kind=app crea una app di note");
  assert.ok(genericBriefMismatch(result.html, brief));
  assert.equal(fenixReviewer({html:result.html,brief,kind:"app"}).retry, true);
  const report = auditGraphicQuality(result.html, { brief, kind: "app" });
  assert.equal(report.ok, false);
  assert.ok(report.findings.some(f => f.code === "brief-mismatch"));
  assert.equal(genericBriefMismatch(result.html, "crea una app di note"), null);
});

test("generic icon retains transparent interiors instead of a solid rectangle", () => {
  const mark = crispAppMarkSvg("note", "Note");
  assert.match(mark, /<g fill="none" color="#E0F2FE" stroke="#E0F2FE"/);
});
