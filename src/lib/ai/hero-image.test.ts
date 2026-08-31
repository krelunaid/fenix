import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CRAFT_HERO_MARKUP,
  CRAFT_HERO_SRC,
  heroAspect,
  injectCraftHero,
  injectHero,
  isHeroSrc,
  materializeHero,
  scrubCraftMedia,
} from "./hero-image.ts";

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
    assert.match(data, /fk-hero-craft/);
    assert.match(data, /photo-1610701596007/);
    assert.doesNotMatch(data, /src="data:image\/png;base64,/);
    assert.equal(injectHero(html, "javascript:alert(1)"), html);
    assert.equal(injectHero(html, 'https://x.example/"onclick=alert(1)'), html);
    assert.equal(isHeroSrc("https://x.ai/a.jpg"), true);
    assert.equal(isHeroSrc(DATA), true);
    assert.equal(isHeroSrc("data:text/html,x"), false);
    assert.equal(heroAspect('<div class="fk-tab"></div>'), "1:1");
    assert.equal(heroAspect("<main></main>"), "16:9");
    assert.equal(heroAspect('<button data-view="home">Home</button>'), "16:9");
    const siteHero = injectHero("<html><body><main></main></body></html>", DATA);
    assert.match(siteHero, /fk-hero-craft/);
    const phone = injectHero('<html><body><nav class="fk-tab"></nav><main></main></body></html>', DATA);
    assert.match(phone, /src="data:image\/png;base64,/);
    assert.match(phone, /this.removeAttribute\('src'\)/);
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

  it("scrubCraftMedia replaces page-screenshot data heroes and dead unsplash", () => {
    const html = `<html><body><img class="fk-hero" src="${DATA}" alt=""/><img src="https://images.unsplash.com/photo-1595878715977-2e8f8df18ea7?w=800" alt="Piatto da portata"/></body></html>`;
    const next = scrubCraftMedia(html);
    assert.match(next, /fk-hero-craft/);
    assert.match(next, /photo-1610701596007/);
    assert.doesNotMatch(next, /data:image\/png/);
    assert.doesNotMatch(next, /photo-1595878715977/);
    assert.match(next, /Piatto da portata/);
    assert.equal(scrubCraftMedia(next), next);
    const craft = injectCraftHero("<html><body><main></main></body></html>");
    assert.match(craft, /fk-hero-craft/);
    assert.equal(CRAFT_HERO_MARKUP.includes("Ceramiche in terracotta"), true);
    assert.equal(CRAFT_HERO_SRC.includes("photo-1610701596007"), true);
    const phone = scrubCraftMedia(
      `<html><body><nav class="fk-tab"></nav><img class="fk-hero" src="${DATA}" alt=""/></body></html>`,
    );
    assert.match(phone, /data:image\/png/);
  });
});
