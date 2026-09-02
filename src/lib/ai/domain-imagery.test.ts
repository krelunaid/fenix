import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatPrefix } from "../projects/infer.ts";
import { familyFromBrief, variantFromBrief } from "../projects/design-tokens.ts";
import {
  DOMAIN_IMAGERY_PROVENANCE,
  HERO_IMAGE_CREDIT,
  altForBrief,
  domainIllustration,
  ensureDomainImagery,
  heroPromptForBrief,
  upgradeProductChrome,
} from "./domain-imagery.ts";
import { auditGraphicQuality } from "../projects/graphic-quality.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("domain imagery", () => {
  it("registers original provenance for every product family and forbids hotlink brands", () => {
    assert.equal(DOMAIN_IMAGERY_PROVENANCE.length, 16);
    for (const row of DOMAIN_IMAGERY_PROVENANCE) {
      assert.equal(row.license, "CC0");
      assert.match(row.source, /repository-native SVG/i);
      assert.doesNotMatch(row.source, /apple|emergent|unsplash/i);
      assert.match(row.notes, /Nessun asset/);
      const svg = domainIllustration(row.family, row.variant, row.subject, 0);
      assert.match(svg, /data-imagery="domain"/);
      assert.match(svg, /aria-label=/);
      assert.match(svg, /role="img"/);
    }
    assert.equal(HERO_IMAGE_CREDIT.authorized, true);
    assert.match(HERO_IMAGE_CREDIT.fallback, /SVG/);
  });

  it("builds family-specific Imagine prompts and alt text", () => {
    const perfume = `${formatPrefix("app")}Maison Lumière flaconi profumi`;
    const fashion = `${formatPrefix("app")}Sfilata moda lookbook`;
    assert.match(heroPromptForBrief(perfume), /perfume bottle/i);
    assert.match(heroPromptForBrief(fashion), /garment|atelier/i);
    assert.notEqual(heroPromptForBrief(perfume), heroPromptForBrief(fashion));
    assert.match(altForBrief(perfume), /flacone/i);
    assert.doesNotMatch(heroPromptForBrief(perfume), /clay, kiln, tools, hands, vessels/);
  });

  it("upgrades stored geometric heroes at generation time without the audit doing so", () => {
    const brief = `${formatPrefix("app")}Maison Lumière: gestione profumi premium, flaconi.`;
    const html = readFileSync(join(here, "fixtures/graphic/maison-lumiere.html"), "utf8");
    const before = auditGraphicQuality(html, { brief, kind: "app" });
    assert.equal(before.ok, false);
    assert.ok(before.findings.some((f) => f.code === "abstract-imagery"));
    const upgraded = upgradeProductChrome(html, brief);
    assert.match(upgraded, /data-imagery="domain"/);
    assert.doesNotMatch(upgraded, /width:min\(1080px/);
    const after = auditGraphicQuality(upgraded, { brief, kind: "app" });
    assert.equal(after.findings.some((f) => f.code === "abstract-imagery"), false);
    assert.equal(after.findings.some((f) => f.code === "boxed-canvas"), false);
    assert.equal(ensureDomainImagery(html, "forno kiln ceramica"), html);
    assert.equal(familyFromBrief("Kiln cruscotto forno"), "ceramic");
    assert.equal(variantFromBrief(brief), 0);
    assert.equal(variantFromBrief(`${formatPrefix("app")}Vetro di Nebbia profumi flaconi`), 1);
  });
});
