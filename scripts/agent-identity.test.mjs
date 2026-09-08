import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveIdentity, setSessionResolverForTests } from "../src/lib/agent/identity.server.ts";
import { ownerHash } from "../src/lib/agent/credits-store.ts";

const CAP = "c".repeat(32);

test("session wins over the capability and is stable across devices; capability is the fallback; nothing → null", async () => {
  setSessionResolverForTests(async (req) => (req.headers.get("cookie")?.includes("sess=1") ? { id: "user-42", email: "a@b.it" } : null));
  try {
    const withSession = await resolveIdentity(new Request("https://f/x", { headers: { cookie: "sess=1", "x-fenix-owner": CAP } }));
    assert.equal(withSession.kind, "session");
    assert.equal(withSession.hash, ownerHash("user:user-42"));
    assert.equal(withSession.email, "a@b.it");
    const otherDevice = await resolveIdentity(new Request("https://f/x", { headers: { cookie: "sess=1", "x-fenix-owner": "d".repeat(32) } }));
    assert.equal(otherDevice.hash, withSession.hash, "same person, different device capability");
    const capOnly = await resolveIdentity(new Request("https://f/x", { headers: { "x-fenix-owner": CAP } }));
    assert.equal(capOnly.kind, "capability");
    assert.equal(capOnly.hash, ownerHash(CAP));
    assert.equal(await resolveIdentity(new Request("https://f/x")), null);
    assert.equal(await resolveIdentity(new Request("https://f/x", { headers: { "x-fenix-owner": "not-hex" } })), null);
  } finally {
    setSessionResolverForTests(undefined);
  }
});

test("an error from the session resolver propagates instead of minting an identity", async () => {
  setSessionResolverForTests(async () => { throw new Error("db down"); });
  try {
    await assert.rejects(resolveIdentity(new Request("https://f/x", { headers: { "x-fenix-owner": CAP } })));
  } finally {
    setSessionResolverForTests(undefined);
  }
});
