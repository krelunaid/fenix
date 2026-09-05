import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import { MAX_REQUEST_BYTES, readWorkerBody } from "../workers/visual/request-body.mjs";

function request(raw, headers = {}) {
  const req = Readable.from([Buffer.from(raw)]);
  req.headers = headers;
  return req;
}

test("transport limit is inclusive and measured in UTF-8 bytes, not string length", async () => {
  const exact = '{"padding":"' + "x".repeat(MAX_REQUEST_BYTES - 14) + '"}';
  assert.equal(Buffer.byteLength(exact), MAX_REQUEST_BYTES);
  assert.equal((await readWorkerBody(request(exact))).padding.length, MAX_REQUEST_BYTES - 14);
  await assert.rejects(readWorkerBody(request(exact + " ")), {status:413});
  const unicode = JSON.stringify({padding:"é".repeat(MAX_REQUEST_BYTES / 2)});
  assert.ok(unicode.length < MAX_REQUEST_BYTES);
  assert.ok(Buffer.byteLength(unicode) > MAX_REQUEST_BYTES);
  await assert.rejects(readWorkerBody(request(unicode)), {status:413});
});

test("full 120k escaped artifact remains accepted without truncation", async () => {
  const raw = '{"prompt":"Fixture","html":"' + "\\u0061".repeat(120000) + '"}';
  assert.ok(Buffer.byteLength(raw) < MAX_REQUEST_BYTES);
  assert.equal((await readWorkerBody(request(raw))).html, "a".repeat(120000));
});

test("declared oversize is rejected before any iterator or JSON parsing", async () => {
  let resumed = false;
  const req = {
    headers:{"content-length":String(MAX_REQUEST_BYTES + 1)},
    resume() { resumed = true; },
    iterator() { throw new Error("must not read"); },
  };
  await assert.rejects(readWorkerBody(req), {status:413});
  assert.equal(resumed, true);
});
