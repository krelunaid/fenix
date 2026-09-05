import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { verifyVisualStyleEffect } from '../workers/visual/visual-style-effect.mjs';

const plan = { version: 1, rules: [{ selector: '.brand', declarations: { 'font-size': '28px' } }] };
const html = '<html data-grammar="agenda"><head><style data-fenix-craft>.brand{font-size:16px}</style></head><body><header class="brand">Agenda</header><main id="root"></main><nav id="tabs"></nav></body></html>';

test('static visual gate runs no app JavaScript and permits no network requests', { timeout: 15000 }, async () => {
  let requests = 0;
  const server = createServer((_, response) => { requests++; response.end('unexpected'); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/must-not-load`;
  try {
    const artifact = html.replace('</head>', `<link rel="stylesheet" href="${url}"></head>`).replace('</body>', `<img src="${url}"><iframe src="${url}"></iframe><script>document.querySelector('.brand').remove();fetch('${url}')</script></body>`);
    const styled = await verifyVisualStyleEffect(artifact, plan);
    assert.equal(styled.slice(styled.indexOf('</head>')), artifact.slice(artifact.indexOf('</head>')));
    assert.equal(requests, 0, 'no generated request reaches even loopback');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('static visual gate rejects hidden ancestor and runtime-only targets', { timeout: 15000 }, async () => {
  await assert.rejects(verifyVisualStyleEffect(html.replace('<header', '<section style="opacity:0"><header').replace('</header>', '</header></section>'), plan), /Target visuale assente/);
  await assert.rejects(verifyVisualStyleEffect(html.replace('<header class="brand">Agenda</header>', '<script>document.body.insertAdjacentHTML("beforeend",\'<header class="brand">Agenda</header>\')</script>'), plan), /Target visuale assente/);
});
