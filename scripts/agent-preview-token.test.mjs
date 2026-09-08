import assert from "node:assert/strict";
import { test } from "node:test";
import { mintPreviewToken, verifyPreviewToken } from "../src/lib/agent/preview-token.ts";

const SECRET = "agent-token-0123456789abcdef";
const OWNER = "a".repeat(64);

test("mint/verify round-trip; tampering, wrong secret and expiry are rejected", () => {
  const t = mintPreviewToken("job-1234-abcd", OWNER, SECRET, 1_000_000);
  const ok = verifyPreviewToken(t, SECRET, 1_000_000 + 60_000);
  assert.deepEqual(ok, { jobId: "job-1234-abcd", owner: OWNER, exp: 1_000_000 + 30 * 60_000 });
  assert.equal(verifyPreviewToken(t, "other-secret-0123456789", 1_000_000), null);
  assert.equal(verifyPreviewToken(t, SECRET, 1_000_000 + 31 * 60_000), null, "expired");
  const [payload, sig] = t.split(".");
  assert.equal(verifyPreviewToken(`${payload}x.${sig}`, SECRET, 1_000_000), null, "tampered payload");
  assert.equal(verifyPreviewToken(`${payload}.${sig.slice(0, -1)}A`, SECRET, 1_000_000), null, "tampered sig");
  assert.equal(verifyPreviewToken("", SECRET), null);
  assert.equal(verifyPreviewToken("a.b", SECRET), null);
});
