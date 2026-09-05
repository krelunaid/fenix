import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MAX_ARTIFACT_CHARS } from '../workers/visual/artifact-context.mjs';

// Resolve the existing TS aliases/extensions without replacing the router,
// handler or product logic. All provider traffic below is mocked explicitly.
const hook = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) specifier = new URL(`../src/${specifier.slice(2)}`, import.meta.url).href;
    if (specifier.startsWith('file:') || specifier.startsWith('.')) {
      const url = new URL(specifier, context.parentURL);
      if (url.protocol === 'file:' && !existsSync(fileURLToPath(url))) {
        for (const suffix of ['.ts', '.tsx', '/index.ts']) {
          if (existsSync(fileURLToPath(url) + suffix)) { specifier = url.href + suffix; break; }
        }
      }
    }
    return next(specifier, context);
  },
});
let handler;
try {
  const { Route } = await import('../src/routes/api/build.ts');
  handler = Route.options.server.handlers.POST;
} finally { hook.deregister(); }

const request = html => ({ request: new Request('https://fixture.invalid/api/build', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'Agenda appuntamenti', instruction: 'Modifica il titolo', html }),
}) });

test('actual server route keeps 95k/120k HTML and rejects oversize before provider calls', { timeout: 15000 }, async () => {
  const key = process.env.XAI_API_KEY;
  const fetch = globalThis.fetch;
  const calls = [];
  process.env.XAI_API_KEY = 'fixture-not-a-secret';
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.x.ai/v1/chat/completions');
    calls.push(JSON.parse(options.body));
    return new Response('fixture-stop', { status: 503 });
  };
  try {
    for (const length of [95000, MAX_ARTIFACT_CHARS]) {
      const tail = '<script>window.tail="$&";</script></body></html>';
      const html = '<html><body>' + 'x'.repeat(length - 12 - tail.length) + tail;
      const response = await handler(request(html));
      assert.match(await response.text(), /fixture-stop/);
      assert.ok(calls.at(-1).messages.some(message => typeof message.content === 'string' && message.content.includes(html)));
      assert.equal(calls.at(-1).model, 'grok-build-0.1');
    }
    const count = calls.length;
    assert.equal((await handler(request('x'.repeat(MAX_ARTIFACT_CHARS + 1)))).status, 413);
    assert.equal((await handler(request({ invalid: true }))).status, 400);
    assert.equal(calls.length, count);
  } finally {
    globalThis.fetch = fetch;
    if (key === undefined) delete process.env.XAI_API_KEY; else process.env.XAI_API_KEY = key;
  }
});

test('actual server route cancels explicit incomplete streams without successful salvage', { timeout: 15000 }, async () => {
  const key = process.env.XAI_API_KEY;
  const fetch = globalThis.fetch;
  process.env.XAI_API_KEY = 'fixture-not-a-secret';
  const content = '<!doctype html><html><head><title>Agenda</title></head><body><h1>Agenda</h1></body></html>';
  try {
    for (const reason of ['length', 'content_filter', 'tool_calls']) {
      for (const sameChunk of [false, true]) {
        let calls = 0;
        let cancelled = false;
        globalThis.fetch = async () => {
          assert.equal(++calls, 1, 'no QA/repair/image call after rejected response');
          const chunks = sameChunk
            ? [{ choices: [{ delta: { content }, finish_reason: reason }] }]
            : [{ choices: [{ delta: { content } }] }, { choices: [{ delta: {}, finish_reason: reason }] }];
          return new Response(new ReadableStream({
            start(controller) { for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`)); },
            cancel() { cancelled = true; },
          }), { headers: { 'Content-Type': 'text/event-stream' } });
        };
        const response = await handler(request(content));
        const events = (await response.text()).split('\n').filter(line => line.startsWith('data:')).map(line => JSON.parse(line.slice(5)));
        assert.equal(events.filter(event => event.t === 'err').length, 1);
        assert.equal(events.filter(event => event.t === 'ok').length, 0);
        assert.match(events.at(-1).error, /Risposta del modello incompleta/);
        assert.equal(cancelled, true);
        assert.equal(calls, 1);
      }
    }
  } finally {
    globalThis.fetch = fetch;
    if (key === undefined) delete process.env.XAI_API_KEY; else process.env.XAI_API_KEY = key;
  }
});
