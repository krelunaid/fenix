import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scanFiles, scanText } from "./secret-scan.mjs";

describe("secret-scan", () => {
  it("flags a pem and a live-looking token, ignores env names", () => {
    const pem = "-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----";
    assert.equal(scanText(pem, "src/lib/x.ts")[0]?.kind, "pem");
    assert.equal(scanText("NETLIFY_AUTH_TOKEN=", "src/lib/x.ts").length, 0);
    assert.equal(scanText("nfp_abcdefghijklmnopqrstuv", "src/lib/x.ts")[0]?.kind, "netlify-token");
    const hits = scanFiles(["a.ts", "b.test.ts"], (f) =>
      f === "a.ts" ? "xai-abcdefghijklmnopqrstuvwx" : "-----BEGIN PRIVATE KEY-----",
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, "xai");
  });
});
