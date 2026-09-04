import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pollProduction, probeProduction, smokeConfig } from "./production-smoke.mjs";

const SHA = "a".repeat(40);

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function goodFetch(url, init = {}) {
  if (url.endsWith("/fenix-release.json")) {
    return Promise.resolve(response({ sha: SHA, assets: ["index-proof_1.js"] }));
  }
  if (url.endsWith("/api/build")) {
    assert.equal(init.method, "POST");
    assert.equal(init.body, "{}");
    return Promise.resolve(response({ t: "err", error: "Scrivi cosa vuoi costruire." }, 400));
  }
  if (url.includes("railway.app")) {
    return Promise.resolve(response({ ok: true, model: "grok-build-0.1", passes: 5 }));
  }
  return Promise.resolve(response("ok"));
}

const config = smokeConfig({
  FENIX_EXPECTED_SHA: SHA,
  FENIX_SMOKE_ATTEMPTS: "3",
  FENIX_SMOKE_WAIT_MS: "0",
});

describe("production smoke configuration", () => {
  it("requires an exact SHA and HTTPS endpoints", () => {
    assert.deepEqual(smokeConfig({}), {
      error: "FENIX_EXPECTED_SHA deve essere uno SHA Git completo.",
    });
    assert.deepEqual(
      smokeConfig({ FENIX_EXPECTED_SHA: SHA, FENIX_PRODUCTION_URL: "http://fenix.test" }),
      { error: "Gli endpoint produzione devono usare HTTPS." },
    );
    assert.ok(!("error" in config));
  });
});

describe("production smoke probe", () => {
  it("pins release SHA, root, hashed asset, Edge and Railway model", async () => {
    assert.ok(!("error" in config));
    const result = await probeProduction(config, { fetchFn: goodFetch, now: () => 0 });
    assert.equal(result.ready, true);
    assert.equal(result.sha, SHA);
    assert.equal(result.asset, "index-proof_1.js");
    assert.deepEqual(result.railway, { ok: true, model: "grok-build-0.1", passes: 5 });
  });

  it("fails closed on Edge drift, wrong Railway model and SLO breach", async () => {
    assert.ok(!("error" in config));
    const badEdge = await probeProduction(config, {
      fetchFn: (url, init) =>
        url.endsWith("/api/build") ? Promise.resolve(response({ t: "ok" })) : goodFetch(url, init),
      now: () => 0,
    });
    assert.equal(badEdge.ready, false);
    assert.equal(badEdge.reason, "Edge Function non conforme");

    const wrongModel = await probeProduction(config, {
      fetchFn: (url, init) =>
        url.includes("railway.app")
          ? Promise.resolve(response({ ok: true, model: "altro", passes: 5 }))
          : goodFetch(url, init),
      now: () => 0,
    });
    assert.equal(wrongModel.ready, false);
    assert.equal(wrongModel.reason, "Railway health non conforme");

    let clock = 0;
    const tooSlow = await probeProduction(config, {
      fetchFn: goodFetch,
      now: () => {
        clock += 9_000;
        return clock;
      },
    });
    assert.equal(tooSlow.ready, false);
    assert.match(tooSlow.reason, /^SLO 8000ms superato:/);
  });
});

describe("production smoke deploy wait", () => {
  it("waits for the exact Netlify SHA and stays bounded", async () => {
    assert.ok(!("error" in config));
    let releaseCalls = 0;
    let sleeps = 0;
    const result = await pollProduction(config, {
      fetchFn: (url, init) => {
        if (url.endsWith("/fenix-release.json")) {
          releaseCalls += 1;
          return Promise.resolve(
            response({
              sha: releaseCalls < 3 ? "b".repeat(40) : SHA,
              assets: ["index-proof_1.js"],
            }),
          );
        }
        return goodFetch(url, init);
      },
      now: () => 0,
      sleep: async () => {
        sleeps += 1;
      },
    });
    assert.equal(result.ready, true);
    assert.equal(result.attempt, 3);
    assert.equal(sleeps, 2);
  });
});
