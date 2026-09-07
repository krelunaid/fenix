import assert from "node:assert/strict";
import { test } from "node:test";
import { rejectCrossOrigin, sanitizeShot, MAX_SHOT_CHARS } from "../src/lib/ai/request-guard.ts";

const H = (o) => ({ get: (k) => o[k.toLowerCase()] ?? null });
const URL_ = "https://fenix.kreluna.it/api/build";

test("same-origin and header-less requests pass; other origins and cross-site scripts are refused", () => {
  assert.equal(rejectCrossOrigin(URL_, H({ origin: "https://fenix.kreluna.it", "sec-fetch-site": "same-origin" })), null);
  assert.equal(rejectCrossOrigin(URL_, H({})), null);
  assert.match(rejectCrossOrigin(URL_, H({ origin: "https://evil.example" })), /Origine/);
  assert.match(rejectCrossOrigin(URL_, H({ "sec-fetch-site": "cross-site" })), /cross-site/);
  assert.equal(rejectCrossOrigin(URL_, H({ origin: "https://studio.kreluna.it" }), ["https://studio.kreluna.it"]), null);
  assert.equal(rejectCrossOrigin("http://localhost:8080/api/build", H({ origin: "http://localhost:8080" })), null);
});

test("screenshots are dropped on create and capped on edit", () => {
  const shot = `data:image/png;base64,${"A".repeat(MAX_SHOT_CHARS * 2)}`;
  assert.equal(sanitizeShot(shot, "create", "<html>"), "");
  assert.equal(sanitizeShot(shot, undefined, ""), "");
  assert.equal(sanitizeShot("not-an-image", undefined, "<html>"), "");
  assert.equal(sanitizeShot(shot, undefined, "<html>").length, MAX_SHOT_CHARS);
});
