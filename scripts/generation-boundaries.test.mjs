import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseProjectFiles } from '../src/lib/projects/files.ts';
import { hydratePortableBackendFiles } from '../src/lib/projects/portable-backend.ts';
import { parseBuildOutput } from '../src/lib/ai/parse.ts';
import { parseResult, repairPass } from '../netlify/edge-functions/build.ts';
import { repairBuild } from '../src/lib/ai/repair.ts';
import { repairFilesContext } from '../src/lib/ai/repair-context.ts';
import { gateIncompleteHtml } from '../src/lib/projects/fenix-adapter.ts';

const spec = { collections: [{ name: 'appuntamenti', fields: [{ name: 'cliente', type: 'text', required: true }] }] };
const html = '<!DOCTYPE html><html><head><title>Agenda</title></head><body><h1>Appuntamenti</h1><p>Prenota un appuntamento.</p></body></html>';
const meta = { name: 'Orario', kind: 'app', palette: { bg: '#ffffff', surface: '#eeeeee', fg: '#172124', muted: '#4b575b', accent: '#176b5b' } };
const payload = `<<<META>>>\n${JSON.stringify(meta)}\n<<<FILE path="backend/fenix.backend.json">>>\n${JSON.stringify(spec)}\n<<<HTML>>>\n${html}\n<<<END>>>`;

test('valid backend manifest immediately before HTML remains valid JSON', () => {
  const files = parseProjectFiles(payload);
  const manifest = files.find(f => f.path === 'backend/fenix.backend.json');
  assert.ok(manifest);
  assert.doesNotMatch(manifest.content, /<<<HTML>>>|<!DOCTYPE/);
  assert.deepEqual(JSON.parse(manifest.content).collections, spec.collections);
  assert.equal(hydratePortableBackendFiles(files).errors.length, 0);
  assert.ok(files.some(f => f.path === 'backend/server.mjs'));
});

test('shared build parser preserves metadata and backend across FILE→HTML boundary', () => {
  const result = parseBuildOutput(payload, 'app', 'Agenda appuntamenti');
  assert.ok(result);
  assert.equal(result.name, meta.name);
  assert.deepEqual(result.palette, meta.palette);
  assert.equal(hydratePortableBackendFiles(result.files).errors.length, 0);
});

test('malformed backend is still rejected, never silently replaced', () => {
  const files = parseProjectFiles(payload.replace(JSON.stringify(spec), '{"collections":'));
  assert.deepEqual(hydratePortableBackendFiles(files).errors, ['Manifest backend JSON non valido.']);
});

test('actual Edge parser keeps FILE-first metadata and requested system typography', () => {
  const result = parseResult(payload, 'app', 'Agenda appuntamenti, stile iPhone');
  assert.ok(result);
  assert.equal(result.name, meta.name);
  assert.deepEqual(result.palette, meta.palette);
  assert.equal(hydratePortableBackendFiles(result.files).errors.length, 0);
  assert.match(result.html, /--body:ui-sans-serif,system-ui/);
  assert.equal(result.files.find(f => f.path === 'index.html').content, result.html);
});

test('FILE boundaries keep CSS, JSON and HTML separate in both output orders', () => {
  for (const text of [
    `<<<FILE path="theme.css">>>\nbody{color:red}\n<<<HTML>>>\n${html}\n<<<END>>>`,
    `<<<HTML>>>\n${html}\n<<<FILE path="theme.css">>>\nbody{color:red}\n<<<END>>>`,
  ]) {
    assert.equal(parseProjectFiles(text).find(f => f.path === 'theme.css').content, 'body{color:red}');
  }
});

test('Node and Edge repair receive the broken manifest and non-HTML sources intact', async () => {
  const previousFetch = globalThis.fetch;
  const files = [{ path: 'backend/fenix.backend.json', content: '{"collections":' },
    { path: 'data/messages.json', content: '{"label":"messaggi $&"}' }];
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), 'https://api.x.ai/v1/chat/completions');
    const request = JSON.parse(init.body);
    const content = request.messages.at(-1).content;
    assert.ok(content.includes(JSON.stringify(files)), 'repair sees actual invalid file, not just error text');
    assert.equal(request.model, 'grok-build-0.1');
    assert.equal('reasoningEffort' in request, false);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: payload } }] });
  };
  try {
    const node = await repairBuild({ apiKey: 'fixture-unused', prompt: 'Agenda', html, files, error: 'Manifest backend JSON non valido.' });
    assert.equal(hydratePortableBackendFiles(node.files).errors.length, 0);
    const edge = parseResult(await repairPass('fixture-unused', 'Agenda', html, 'Manifest backend JSON non valido.', files));
    assert.equal(hydratePortableBackendFiles(edge.files).errors.length, 0);
    const huge = [{ path: 'notes.txt', content: 'x'.repeat(120001) }];
    assert.equal(await repairBuild({ apiKey: 'fixture-unused', prompt: 'Agenda', html, files: huge, error: 'fixture' }), null);
    assert.equal(await repairPass('fixture-unused', 'Agenda', html, 'fixture', huge), '');
    assert.equal(calls, 2, 'oversize files do not spend provider calls');
  } finally { globalThis.fetch = previousFetch; }
});

test('repair context keeps manifest but not locally derived backend server code', () => {
  const hydrated = parseProjectFiles(payload);
  const context = repairFilesContext(hydrated);
  assert.match(context, /backend\/fenix.backend.json/);
  assert.doesNotMatch(context, /backend\/server.mjs|scryptSync/);
});

test('shared gate passes current files to both capped repair attempts', async () => {
  const files = [{ path: 'backend/fenix.backend.json', content: '{"collections":' }];
  let calls = 0;
  const result = await gateIncompleteHtml({
    prompt: 'FORMATO: app. kind=app. Agenda con login e backend',
    result: { ...meta, html, files, tagline: '', summary: '', direction: '' },
    repair: async input => { calls++; assert.deepEqual(input.files, files); return null; },
  });
  assert.equal(calls, 2);
  assert.ok('error' in result);
  assert.match(result.error, /Manifest backend JSON non valido/);
});
