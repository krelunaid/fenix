import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatPrefix } from "../projects/infer.ts";
import { familyFromBrief, variantFromBrief } from "../projects/design-tokens.ts";
import {
  DOMAIN_IMAGERY_PROVENANCE,
  GEOMETRIC_REGRESSIONS,
  HERO_IMAGE_CREDIT,
  altForBrief,
  domainIllustration,
  ensureDomainImagery,
  heroPromptForBrief,
  materialSignature,
  perfumeFocusFitsThumb,
  perfumeSubjectBox,
  perfumeThumbViewBox,
  upgradeProductChrome,
} from "./domain-imagery.ts";
import { auditGraphicQuality } from "../projects/graphic-quality.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("domain imagery", () => {
  it("registers original provenance for every product family and forbids hotlink brands", () => {
    assert.equal(DOMAIN_IMAGERY_PROVENANCE.length, 18);
    for (const row of DOMAIN_IMAGERY_PROVENANCE) {
      assert.equal(row.license, "CC0");
      assert.match(row.source, /repository-native SVG/i);
      assert.doesNotMatch(row.source, /apple|emergent|unsplash/i);
      assert.match(row.notes, /Nessun asset/);
      const svg = domainIllustration(row.family, row.variant, row.subject, 0);
      assert.match(svg, /data-imagery="domain"/);
      assert.match(svg, /aria-label=/);
      assert.match(svg, /role="img"/);
      const next = domainIllustration(row.family, row.variant, row.subject, 1);
      assert.notEqual(svg, next, row.id);
    }
    assert.equal(HERO_IMAGE_CREDIT.authorized, false);
    assert.equal(HERO_IMAGE_CREDIT.model, null);
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

  it("rejects 7c3245c geometric leftovers and requires material parts on fashion/food/editorial", () => {
    const oldCoat = `<path d="M250 46l54-16 54 16 44 36-26 42v228l-72 40-72-40V140l-26-42z"/>`;
    const oldYoke = `<path d="M232 86h176l22 34H210z"/>`;
    const oldFish = `<path d="M220 222c44-28 96-16 124 16 36-32 92-18 128 20"/>`;
    const oldPlate = `<rect x="56" y="56" width="340" height="230" fill="#c9b496"/><rect x="74" y="74" width="304" height="194" fill="#6a5e52"/>`;
    assert.ok(GEOMETRIC_REGRESSIONS.some((r) => r.test(oldCoat)), "coat trapezoid must stay a failing fixture");
    assert.ok(GEOMETRIC_REGRESSIONS.some((r) => r.test(oldYoke)));
    assert.ok(GEOMETRIC_REGRESSIONS.some((r) => r.test(oldFish)));
    assert.ok(GEOMETRIC_REGRESSIONS.some((r) => r.test(oldPlate)));
    for (const family of ["fashion", "food", "editorial"] as const) {
      for (const variant of [0, 1] as const) {
        for (const slot of [0, 1, 2, 3]) {
          const svg = domainIllustration(family, variant, family, slot);
          for (const re of GEOMETRIC_REGRESSIONS) {
            assert.equal(re.test(svg), false, `${family}/${variant}/${slot} ${re}`);
          }
          const sig = materialSignature(svg);
          if (family === "food" && variant === 0) continue;
          if (family === "editorial" && variant === 1) continue;
          const minMarks = family === "editorial" ? 10 : 16;
          assert.ok(sig.marks >= minMarks, `${family}/${variant}/${slot} marks ${sig.marks}`);
          assert.ok(sig.gradients >= 1, `${family}/${variant}/${slot} gradients`);
        }
      }
    }
    const coat = materialSignature(domainIllustration("fashion", 0, "cappotto", 0));
    assert.equal(coat.garment, "coat");
    for (const part of ["lapel", "sleeve", "seam", "pocket", "button", "collar", "lining", "dress-form", "shoulder", "waist", "hem"]) {
      assert.ok(coat.parts.includes(part), `coat missing ${part} (${coat.parts.join(",")})`);
    }
    assert.ok(coat.paths >= 22, `coat paths ${coat.paths}`);
    const dress = materialSignature(domainIllustration("fashion", 0, "abito", 1));
    assert.equal(dress.garment, "dress");
    assert.ok(dress.parts.includes("bodice") && dress.parts.includes("column") && dress.parts.includes("hip"), `dress parts ${dress.parts}`);
    const trousers = materialSignature(domainIllustration("fashion", 0, "pantalone", 2));
    assert.equal(trousers.garment, "trousers");
    for (const part of ["waistband", "crease", "leg", "cuff", "hanger", "seat", "drape"]) {
      assert.ok(trousers.parts.includes(part), `trousers missing ${part}`);
    }
    assert.ok(trousers.paths >= 16, `trousers paths ${trousers.paths}`);
    const ossoSkirt = materialSignature(domainIllustration("fashion", 1, "gonna", 2));
    assert.equal(ossoSkirt.garment, "skirt");
    assert.ok(ossoSkirt.parts.includes("pleat") && ossoSkirt.parts.includes("waistband"));
    const garments = [0, 1, 2, 3].map((s) => materialSignature(domainIllustration("fashion", 0, "c", s)).garment);
    assert.equal(new Set(garments).size, 4, String(garments));
    const dishes = [0, 1, 2, 3].map((s) => materialSignature(domainIllustration("food", 1, "crudo", s)).dish);
    assert.deepEqual(dishes, ["ricciola", "gambero", "ostrica", "tonno"]);
    const crudo = materialSignature(domainIllustration("food", 1, "crudo", 0));
    for (const part of ["plate", "flesh", "citrus", "herb", "marble"]) {
      assert.ok(crudo.parts.includes(part), `crudo missing ${part}`);
    }
    assert.ok(crudo.paths >= 20, `crudo paths ${crudo.paths}`);
    assert.equal(crudo.dish, "ricciola");
    const gambero = materialSignature(domainIllustration("food", 1, "gambero", 1));
    assert.equal(gambero.dish, "gambero");
    assert.ok(gambero.parts.includes("antenna") && gambero.parts.includes("shell"));
    const ostrica = materialSignature(domainIllustration("food", 1, "ostrica", 2));
    assert.equal(ostrica.dish, "ostrica");
    assert.ok(ostrica.parts.includes("shell"));
    const tonno = materialSignature(domainIllustration("food", 1, "tonno", 3));
    assert.equal(tonno.dish, "tonno");
    assert.ok(tonno.parts.includes("fat-line"));
    assert.ok(crudo.fills.some((c) => c.startsWith("#f6") || c.startsWith("#e2") || c.startsWith("#c4")));
    assert.ok(tonno.fills.includes("#c42838") || tonno.fills.includes("#7a1020") || tonno.fills.includes("#4a0810"));
    const fillSets = [crudo, gambero, ostrica, tonno].map((s) => new Set(s.fills));
    for (let i = 0; i < fillSets.length; i++) {
      for (let j = i + 1; j < fillSets.length; j++) {
        const a = fillSets[i]!;
        const b = fillSets[j]!;
        const inter = [...a].filter((c) => b.has(c)).length;
        const uni = new Set([...a, ...b]).size || 1;
        assert.ok(inter / uni < 0.72, `dish ${i}/${j} fill jaccard ${inter}/${uni}`);
      }
    }
    const garmentSvgs = [0, 1, 2, 3].map((s) => domainIllustration("fashion", 0, "c", s));
    assert.equal(new Set(garmentSvgs).size, 4);
    const dishSvgs = [0, 1, 2, 3].map((s) => domainIllustration("food", 1, "crudo", s));
    assert.equal(new Set(dishSvgs).size, 4);
    assert.notEqual(dishSvgs[0], dishSvgs[1]);
    assert.ok((dishSvgs[0]!.match(/<path\b/g) || []).length !== (dishSvgs[3]!.match(/<path\b/g) || []).length || dishSvgs[0]!.length - dishSvgs[3]!.length > 80);
    const cover = materialSignature(domainIllustration("editorial", 0, "lastra", 0));
    assert.ok(cover.scenes.includes("pozzo"), `cover scenes ${cover.scenes.join(",")}`);
    assert.ok(cover.parts.includes("type"));
    const olivoPlate = materialSignature(domainIllustration("editorial", 0, "olivo", 1));
    assert.ok(olivoPlate.scenes.includes("olivo"));
    assert.ok(olivoPlate.parts.includes("grove") && olivoPlate.parts.includes("terrace"), `olivo parts ${olivoPlate.parts}`);
    const oldOlivo = "M214 176 C198 148 224 108 268 118";
    assert.ok(GEOMETRIC_REGRESSIONS.some((r) => r.test(oldOlivo)));
    assert.equal(GEOMETRIC_REGRESSIONS.some((r) => r.test(domainIllustration("editorial", 0, "olivo", 1))), false);
    const sheet = materialSignature(domainIllustration("editorial", 0, "lastre", 3));
    assert.ok(sheet.scenes.includes("pozzo") && sheet.scenes.includes("olivo") && sheet.scenes.includes("fienile") && sheet.scenes.includes("torchio"));
    assert.ok(sheet.parts.includes("frame"), `contact sheet frames ${sheet.parts}`);
    const oldCapsule = "c16-28 48-40 72-28 24-12 56 0 72 28";
    assert.ok(GEOMETRIC_REGRESSIONS.some((r) => r.test(oldCapsule)));
    assert.equal(GEOMETRIC_REGRESSIONS.some((r) => r.test(domainIllustration("fashion", 0, "c", 0))), false);
    const locandaRooms = [0, 1, 2, 3].map((s) => materialSignature(domainIllustration("hospitality", 0, "camera", s)).room);
    assert.deepEqual(locandaRooms, ["pozzo", "olivo", "fienile", "salice"]);
    const hotelRooms = [0, 1, 2, 3].map((s) => materialSignature(domainIllustration("hospitality", 1, "suite", s)).room);
    assert.deepEqual(hotelRooms, ["champagne", "inchiostro", "attico", "silenzio"]);
    const bottles = [0, 1, 2, 3].map((s) => materialSignature(domainIllustration("perfume", 0, "flacone", s)).bottle);
    assert.deepEqual(bottles, ["nuit", "acqua", "fleur", "pelle"]);
    const ice = [0, 1, 2, 3].map((s) => materialSignature(domainIllustration("perfume", 1, "vetro", s)).bottle);
    assert.deepEqual(ice, ["sale", "nebbia", "pino", "vetro"]);
    for (const variant of [0, 1] as const) {
      for (const slot of [0, 1, 2, 3]) {
        const meet = domainIllustration("perfume", variant, "flacone", slot, "meet");
        const slice = domainIllustration("perfume", variant, "flacone", slot, "slice");
        assert.match(meet, /viewBox="0 0 640 420"/, `${variant}/${slot} hero viewBox`);
        assert.doesNotMatch(meet, /data-focus=/);
        assert.match(slice, /data-focus="/);
        assert.match(slice, /data-thumb-box="/);
        assert.doesNotMatch(slice, /viewBox="0 0 640 420"/);
        const sub = perfumeSubjectBox(variant, slot);
        const box = perfumeThumbViewBox(variant, slot);
        assert.ok(sub.w > 80 && sub.h > 200, `${variant}/${slot} subject ${sub.w}x${sub.h}`);
        assert.equal(box.w, box.h, `${variant}/${slot} thumb box not square ${box.w}x${box.h}`);
        assert.equal(perfumeFocusFitsThumb(variant, slot, 88, 112, 6), true, `${variant}/${slot} 88x112`);
        assert.equal(perfumeFocusFitsThumb(variant, slot, 56, 56, 6), true, `${variant}/${slot} 56x56`);
        assert.equal(materialSignature(meet).bottle, materialSignature(slice).bottle);
      }
    }
    const foodSlice = domainIllustration("food", 0, "piatto", 1, "slice");
    assert.match(foodSlice, /viewBox="0 0 640 420"/);
    assert.doesNotMatch(foodSlice, /data-focus=/);
    const mill = materialSignature(domainIllustration("ops", 0, "ledger", 0));
    assert.equal(mill.scenes.includes("mill") || mill.parts.includes("mill"), true, `ops mill ${mill.scenes} ${mill.parts}`);
    const shears = materialSignature(domainIllustration("utility", 0, "taglio", 0));
    assert.equal(shears.tool, "shears");
    for (const family of ["hospitality", "perfume", "ops"] as const) {
      for (const variant of [0, 1] as const) {
        for (const slot of [0, 1, 2, 3]) {
          const svg = domainIllustration(family, variant, family, slot);
          for (const re of GEOMETRIC_REGRESSIONS) {
            assert.equal(re.test(svg), false, `${family}/${variant}/${slot} ${re}`);
          }
        }
      }
    }
  });

  it("fits perfume and food heroes with meet, thumbs and fashion with slice", () => {
    const perfume = domainIllustration("perfume", 0, "flacone", 0);
    const perfumeThumb = domainIllustration("perfume", 0, "flacone", 1);
    const perfumeWrap = domainIllustration("perfume", 0, "flacone", 4);
    const food = domainIllustration("food", 0, "piatto", 0);
    const foodThumb = domainIllustration("food", 0, "piatto", 1);
    const fashion = domainIllustration("fashion", 0, "cappotto", 0);
    const hospitality = domainIllustration("hospitality", 0, "camera", 0);
    assert.match(perfume, /preserveAspectRatio="xMidYMid meet"/);
    assert.match(perfume, /data-fit="meet"/);
    assert.match(perfumeThumb, /preserveAspectRatio="xMidYMid slice"/);
    assert.match(perfumeThumb, /data-fit="slice"/);
    assert.match(perfumeWrap, /preserveAspectRatio="xMidYMid slice"/);
    assert.match(food, /preserveAspectRatio="xMidYMid meet"/);
    assert.match(foodThumb, /preserveAspectRatio="xMidYMid slice"/);
    assert.match(fashion, /preserveAspectRatio="xMidYMid slice"/);
    assert.match(hospitality, /preserveAspectRatio="xMidYMid slice"/);
    assert.doesNotMatch(fashion, /preserveAspectRatio="xMidYMid meet"/);
    assert.match(perfume, /width="640"/);
    assert.match(perfume, /height="420"/);
    const meet0 = domainIllustration("perfume", 0, "flacone", 0, "meet");
    const slice0 = domainIllustration("perfume", 0, "flacone", 0, "slice");
    assert.equal(materialSignature(meet0).bottle, "nuit");
    assert.equal(materialSignature(slice0).bottle, "nuit");
    assert.match(meet0, /data-fit="meet"/);
    assert.match(slice0, /data-fit="slice"/);
    const meetGid = meet0.match(/filter id="([^"]+)"/)?.[1];
    const sliceGid = slice0.match(/filter id="([^"]+)"/)?.[1];
    assert.ok(meetGid && sliceGid && meetGid !== sliceGid, `gid collide ${meetGid} ${sliceGid}`);
    const osteria = [0, 1, 2, 3].map((s) => materialSignature(domainIllustration("food", 0, "piatto", s)).dish);
    assert.deepEqual(osteria, ["plin", "brasato", "bonet", "tajarin"]);
  });
});
