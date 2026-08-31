import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { heroAspect, injectHero, isHeroSrc, materializeHero } from "./hero-image.ts";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const DATA = `data:image/png;base64,${PNG.toString("base64")}`;

describe("injectHero / materializeHero", () => {
  it("injects https and data image urls, rejects javascript", () => {
    const html = "<html><body><main></main></body></html>";
    const https = injectHero(html, "https://cdn.example/a.jpg");
    assert.match(https, /class="fk-hero"/);
    assert.match(https, /onerror="this.removeAttribute\('src'\)"/);
    const data = injectHero(html, DATA);
    assert.match(data, /src="data:image\/png;base64,/);
    assert.equal(injectHero(html, "javascript:alert(1)"), html);
    assert.equal(injectHero(html, 'https://x.example/"onclick=alert(1)'), html);
    assert.equal(isHeroSrc("https://x.ai/a.jpg"), true);
    assert.equal(isHeroSrc(DATA), true);
    assert.equal(isHeroSrc("data:text/html,x"), false);
    assert.equal(heroAspect('<div class="fk-tab"></div>'), "1:1");
    assert.equal(heroAspect("<main></main>"), "16:9");
    assert.equal(heroAspect('<button data-view="home">Home</button>'), "16:9");
    const siteHero = injectHero("<html><body><main></main></body></html>", DATA);
    assert.match(siteHero, /min\(52vh,560px\)/);
  });

  it("materializeHero inlines reachable image bytes and drops 404", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("hero.png")) {
        return new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
      }
      return new Response("no", { status: 404, headers: { "content-type": "text/plain" } });
    };
    try {
      assert.equal(await materializeHero("https://cdn.example/hero.png"), DATA);
      assert.equal(await materializeHero("https://cdn.example/missing.jpg"), null);
    } finally {
      globalThis.fetch = orig;
    }
    assert.equal(await materializeHero(DATA), DATA);
    assert.equal(await materializeHero("javascript:alert(1)"), null);
  });
});
