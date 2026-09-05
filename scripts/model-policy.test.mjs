import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { generateHeroUrl } from '../src/lib/ai/hero-image.ts';

test('server hero generation makes no secondary model call', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('unexpected network'); };
  try {
    assert.equal(await generateHeroUrl('fixture-key', 'Profumi', undefined, '1:1'), null);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = previous; }
});

test('worker keeps original phone imagery without a secondary model call', async () => {
  const source = readFileSync(new URL('../workers/visual/server.mjs', import.meta.url), 'utf8');
  const hero = source.slice(source.indexOf('async function generateHero('), source.indexOf('\nfunction injectHero('));
  const place = source.slice(source.indexOf('async function placeHero('), source.indexOf('\nfunction stripPhoneChromeFromSite('));
  let calls = 0;
  const context = {
    process: { env: { XAI_API_KEY: 'fixture-key' } },
    fetch: async () => { calls++; throw new Error('unexpected network'); },
    scrubCraftMedia: x => x,
  };
  const placeHero = runInNewContext(`${hero}\n${place}\nplaceHero`, context);
  const html = '<main><svg data-imagery="domain"></svg></main><nav class="fk-tab"></nav>';
  const result = await placeHero(html, 'Profumi');
  assert.equal(result.html, html);
  assert.equal(result.log.length, 0);
  assert.equal(calls, 0);
  for (const path of ['../workers/visual/server.mjs', '../src/lib/ai/hero-image.ts', '../netlify/edge-functions/build.ts']) {
    assert.doesNotMatch(readFileSync(new URL(path, import.meta.url), 'utf8'), /grok-imagine|\/images\/generations/);
  }
});
