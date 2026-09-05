import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { premiumAppMarkSvg, premiumMarkDataUri } from "./premium-mark.ts";

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
});
