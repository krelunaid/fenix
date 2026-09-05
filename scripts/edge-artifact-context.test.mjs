import assert from 'node:assert/strict';
import { test } from 'node:test';
import build, { reviewPass, repairPass } from '../netlify/edge-functions/build.ts';
import { MAX_ARTIFACT_CHARS } from '../workers/visual/artifact-context.mjs';

test('actual Edge handler keeps large edit context and rejects oversize before provider calls', async () => {
  const previousNetlify = globalThis.Netlify;
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.Netlify = { env: { get: () => 'fixture-not-a-secret' } };
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.x.ai/v1/chat/completions');
    calls.push(JSON.parse(options.body));
    // Stop after observing the real outbound payload: no live model call.
    return new Response('fixture-stop', { status: 503 });
  };
  const request = html => new Request('https://fixture.invalid/api/build', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Agenda appuntamenti', instruction: 'Modifica il titolo', html }),
  });
  try {
    for (const length of [95000, MAX_ARTIFACT_CHARS]) {
      const tail = '<script>window.tail="$&";</script></body></html>';
      const html = '<html><body>' + 'x'.repeat(length - 12 - tail.length) + tail;
      assert.equal(html.length, length);
      const response = await build(request(html));
      const output = await response.text();
      assert.match(output, /fixture-stop/);
      assert.equal(calls.at(-1).model, 'grok-build-0.1');
      assert.equal('reasoningEffort' in calls.at(-1), false);
      assert.ok(calls.at(-1).messages.some(message => typeof message.content === 'string' && message.content.includes(html)), 'complete HTML, including tail script');
    }
    const callCount = calls.length;
    const oversized = await build(request('x'.repeat(MAX_ARTIFACT_CHARS + 1)));
    assert.equal(oversized.status, 413);
    assert.match((await oversized.json()).error, /versione precedente resta invariata/);
    const invalid = await build(request({ unexpected: true }));
    assert.equal(invalid.status, 400);
    assert.equal(calls.length, callCount);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = previousNetlify;
  }
});

test('Edge stream never salvages explicit incomplete completions or calls repair after them', async () => {
  const previousNetlify = globalThis.Netlify;
  const previousFetch = globalThis.fetch;
  globalThis.Netlify = { env: { get: () => 'fixture-not-a-secret' } };
  const content = '<!doctype html><html><head><title>Agenda</title></head><body><h1>Agenda</h1></body></html>';
  try {
    for (const reason of ['length', 'content_filter', 'tool_calls']) {
      for (const sameChunk of [false, true]) {
        let calls = 0;
        let cancelled = false;
        globalThis.fetch = async () => {
          calls++;
          assert.equal(calls, 1, 'no QA or repair of rejected completion');
          const chunks = sameChunk
            ? [{ choices: [{ delta: { content }, finish_reason: reason }] }]
            : [{ choices: [{ delta: { content } }] }, { choices: [{ delta: {}, finish_reason: reason }] }];
          const body = new ReadableStream({
            start(controller) {
              for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
              // Keep open: the handler must cancel instead of waiting for EOF.
            },
            cancel() { cancelled = true; },
          });
          return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
        };
        const response = await build(new Request('https://fixture.invalid/api/build', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: 'Agenda', instruction: 'Modifica titolo', html: content }),
        }));
        const events = (await response.text()).split('\n').filter(line => line.startsWith('data:')).map(line => JSON.parse(line.slice(5)));
        assert.equal(events.filter(event => event.t === 'err').length, 1);
        assert.equal(events.filter(event => event.t === 'ok').length, 0);
        assert.match(events.at(-1).error, /Risposta del modello incompleta/);
        assert.equal(calls, 1);
        assert.equal(cancelled, true);
      }
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (previousNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = previousNetlify;
  }
});

test('Edge review and repair receive full documents and discard incomplete provider results', async () => {
  const previousFetch = globalThis.fetch;
  const html = '<html><body>' + 'x'.repeat(95000) + '<script>window.tail="$&"</script></body></html>';
  let calls = 0;
  try {
    for (const pass of [reviewPass, repairPass]) {
      for (const reason of ['stop', 'length', 'content_filter', 'tool_calls']) {
        globalThis.fetch = async (url, options) => {
          calls++;
          assert.equal(String(url), 'https://api.x.ai/v1/chat/completions');
          const payload = JSON.parse(options.body);
          assert.ok(payload.messages.some(message => message.content.includes(html)), '95k context and tail preserved');
          return Response.json({ choices: [{ finish_reason: reason, message: { content: html } }] });
        };
        assert.equal(await pass('fixture-not-a-secret', 'Agenda', html, 'fixture'), reason === 'stop' ? html : '');
      }
      const previousCalls = calls;
      assert.equal(await pass('fixture-not-a-secret', 'Agenda', 'x'.repeat(MAX_ARTIFACT_CHARS + 1), 'fixture'), '');
      assert.equal(calls, previousCalls, 'oversize never sent or sliced');
    }
    assert.equal(calls, 8);
  } finally { globalThis.fetch = previousFetch; }
});
