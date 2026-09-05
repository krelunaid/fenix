import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  crispAppMarkSvg,
  crispBarberMarkSvg,
  crispBookMarkSvg,
  crispWaterDropMarkSvg,
  glossyWaterMarkSvg,
  premiumAppMarkSvg,
  premiumMarkDataUri,
} from "./premium-mark.ts";

describe("premium app mark", () => {
  it("paints a squircle ring with the supplied domain colors and never Apple SET blue", () => {
    const svg = premiumAppMarkSvg(
      "nord-acqua",
      { accent: "#0A2F6B", fg: "#142033", bg: "#F3F5F8" },
      '<svg viewBox="0 0 24 24"><path d="M12 4.8s5 6 5 10"/></svg>',
    );
    assert.match(svg, /data-fenix-premium-mark="1"/);
    assert.match(svg, /data-craft-app="1"/);
    assert.match(svg, /#0A2F6B/);
    assert.match(svg, /#142033/);
    assert.doesNotMatch(svg, /#007aff|#0071e3|#f5f5f7/i);
    assert.match(premiumMarkDataUri(svg), /^data:image\/svg\+xml/);
  });

  it("paints an original glossy drop mark for water ops without Apple SET blue", () => {
    const svg = glossyWaterMarkSvg("nord-acqua", {
      accent: "#0D73C4",
      fg: "#0A2F6B",
      bg: "#F4F7FB",
    });
    assert.match(svg, /data-fenix-water-mark="1"/);
    assert.match(svg, /#0D73C4|#0d73c4/);
    assert.match(svg, /#0A2F6B|#0a2f6b/);
    assert.match(svg, /feDropShadow|radialGradient/);
    assert.doesNotMatch(svg, /#007aff|#0071e3|#f5f5f7/i);
    assert.equal(premiumAppMarkSvg("nord-acqua", { accent: "#0D73C4", fg: "#0A2F6B", bg: "#F4F7FB" }, "<path/>", { water: true }), svg);
  });

  it("paints a high-contrast filled drop chip for header and favicon surfaces", () => {
    const svg = crispWaterDropMarkSvg("home-header");
    assert.match(svg, /data-fenix-water-header="1"/);
    assert.match(svg, /data-fenix-water-mark="1"/);
    assert.match(svg, /M12 4\.4c3\.8 4\.8 5\.6 8\.2/);
    assert.match(svg, /#082338|#0F3A5C/);
    assert.match(svg, /cwd-drop-home-header/);
    assert.doesNotMatch(svg, /fill-opacity="\.18"|fill="none"/);
    assert.doesNotMatch(svg, /#007aff|#0071e3|#f5f5f7/i);
    assert.match(premiumMarkDataUri(svg), /^data:image\/svg\+xml/);
  });

  it("paints filled navy shears and book chips, never an exit door or pale outline", () => {
    const shears = crispBarberMarkSvg("barber-header");
    const book = crispBookMarkSvg("library-header");
    assert.match(shears, /data-fenix-barber-mark="1"/);
    assert.match(shears, /data-fenix-crisp-mark="1"/);
    assert.match(shears, /#082338|#0F3A5C/);
    assert.match(shears, /M9\.4 16\.2 17\.6 5\.6/);
    assert.doesNotMatch(shears, /fill="none"|fill-opacity="\.18"/);
    assert.match(book, /data-fenix-book-mark="1"/);
    assert.match(book, /M8\.2 6\.2h13\.4/);
    assert.doesNotMatch(book, /fill="none"|fill-opacity="\.18"/);
    assert.doesNotMatch(shears, /M10 7V5\.8A1\.8|M4 12h10M11\.2 8\.8/);
    assert.doesNotMatch(book, /M10 7V5\.8A1\.8|M5\.2 5\.2h13\.6/);
    assert.equal(crispAppMarkSvg("x", "Taglio"), shears.replace(/barber-header/g, "x"));
    assert.equal(crispAppMarkSvg("x", "Libri"), book.replace(/library-header/g, "x"));
    assert.doesNotMatch(shears, /#007aff|#0071e3|#f5f5f7/i);
    assert.doesNotMatch(book, /#007aff|#0071e3|#f5f5f7/i);
  });
});
