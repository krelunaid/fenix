import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ensureFenixAdapter } from "../projects/fenix-adapter.ts";
import { OWNER_HEADER } from "../projects/publish-owner.ts";
import { setReleaseAdaptersForTest, type ReleaseAdapter } from "./adapters.ts";
import { createReleaseJob, releaseIdempotencyKey, resumeReleaseJob } from "./engine.ts";
import { generateKeyPairSync } from "node:crypto";
import { handleReleaseCollection, handleReleaseItem } from "./http.ts";
import { suggestedBundleId, validateBundleId, validatePackageName } from "./ids.ts";
import { accountsSnapshot, gateHtml } from "./preflight.ts";
import { redactSecrets } from "./redact.ts";
import { applePreflight, googlePreflight, parseGoogleServiceAccount, setReleaseFetchForTest } from "./store-api.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SITE = readFileSync(join(here, "../projects/fixtures/music-site-no-fenix.html"), "utf8");
const ADAPTED = ensureFenixAdapter(SITE);
const PALETTE = {
  bg: "#120c1c",
  surface: "#1c1528",
  fg: "#f4efe8",
  muted: "#9b93c2",
  accent: "#e85d4c",
  line: "#3a3048",
};
const OWNER_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const PID = "onda-rel-01";

function input(over: Record<string, unknown> = {}) {
  return {
    projectId: PID,
    name: "Onda",
    kind: "site",
    palette: PALETTE,
    html: ADAPTED,
    platforms: ["ios"],
    bundleId: "it.fenix.onda",
    packageName: "it.fenix.onda",
    ...over,
  };
}

describe("release ids and redact", () => {
  it("rejects reserved bundle ids and accepts reverse-DNS", () => {
    assert.equal(typeof validateBundleId("it.fenix.onda"), "string");
    assert.equal("error" in (validateBundleId("com.example.app") as object), true);
    assert.equal("error" in (validatePackageName("Android") as object), true);
    assert.match(suggestedBundleId("Bottega Terra"), /^it\.fenix\.bottegaterra$/);
  });

  it("redacts pem, bearer and private_key from logs", () => {
    const pem = "-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----";
    const out = redactSecrets(`token Bearer abcdefghijklmnop and ${pem} and "private_key":"AAA"`);
    assert.doesNotMatch(out, /BEGIN PRIVATE KEY/);
    assert.doesNotMatch(out, /abcdefghijklmnop/);
    assert.doesNotMatch(out, /AAA/);
    assert.match(out, /\[redacted\]/);
  });
});

describe("release preflight", () => {
  it("blocks invalid srcdoc and allows a complete site", () => {
    const bad = gateHtml("<p>no</p>", "site", PID, PALETTE);
    assert.equal(bad.ok, false);
    const ok = gateHtml(ADAPTED, "site", PID, PALETTE);
    assert.equal(ok.ok, true);
  });
});

describe("release engine", () => {
  const prevPub = process.env.FENIX_PUBLISHED_DIR;
  const prevRel = process.env.FENIX_RELEASE_DIR;
  const pub = mkdtempSync(join(tmpdir(), "fenix-pub-"));
  const rel = mkdtempSync(join(tmpdir(), "fenix-rel-"));

  before(() => {
    process.env.FENIX_PUBLISHED_DIR = pub;
    process.env.FENIX_RELEASE_DIR = rel;
    process.env.FENIX_RELEASE_FIXTURE = "1";
    delete process.env.NETLIFY;
    delete process.env.NETLIFY_BLOBS_CONTEXT;
    delete process.env.APPLE_PRIVATE_KEY;
    delete process.env.GOOGLE_PLAY_JSON;
  });
  after(() => {
    setReleaseAdaptersForTest(null);
    if (prevPub === undefined) delete process.env.FENIX_PUBLISHED_DIR;
    else process.env.FENIX_PUBLISHED_DIR = prevPub;
    if (prevRel === undefined) delete process.env.FENIX_RELEASE_DIR;
    else process.env.FENIX_RELEASE_DIR = prevRel;
  });
  afterEach(() => setReleaseAdaptersForTest(null));

  it("runs iOS fixture to TestFlight without a second upload on retry", async () => {
    let uploads = 0;
    const ios: ReleaseAdapter = {
      platform: "ios",
      connected: () => false,
      async run(step, _job, track) {
        if (step === "upload") {
          uploads += 1;
          if (track.uploads >= 1) {
            return { ok: true, step, fixture: true, artifact: track.artifact };
          }
          return { ok: true, step, fixture: true, artifact: "asc:it.fenix.onda" };
        }
        if (step === "ready") {
          return { ok: true, step: "ready", fixture: true, artifact: "testflight:it.fenix.onda" };
        }
        return { ok: true, step, fixture: true };
      },
    };
    setReleaseAdaptersForTest({ ios });
    const first = await createReleaseJob(input(), { ownerId: OWNER_A });
    assert.equal("status" in first && first.status === "ok", true);
    if ("status" in first && typeof first.status !== "number") {
      assert.equal(first.status, "ok");
      assert.match(first.tracks.ios?.artifact || "", /testflight|asc/);
      assert.match(first.log.join("\n"), /TestFlight/);
      assert.equal(first.tracks.ios?.uploads, 1);
    }
    assert.equal(uploads, 1);
    const again = await createReleaseJob(input(), { ownerId: OWNER_A });
    if ("id" in again) {
      assert.equal(again.id, (first as { id: string }).id);
    }
    assert.equal(uploads, 1);
  });

  it("runs android fixture to internal testing", async () => {
    const job = await createReleaseJob(input({ platforms: ["android"] }), { ownerId: OWNER_A });
    assert.equal((job as { status: string }).status, "ok");
    assert.match((job as { tracks: { android?: { artifact?: string } } }).tracks.android?.artifact || "", /internal/);
    assert.match((job as { log: string[] }).log.join("\n"), /internal/);
  });

  it("publishes web only after HTML gate, never on leaked css", async () => {
    const bad = await createReleaseJob(
      input({
        platforms: ["web"],
        html: `<html><body><p>${"x".repeat(80)}</p></body></html>`,
      }),
      { ownerId: OWNER_A },
    );
    assert.equal((bad as { status: number }).status, 422);

    const ok = await createReleaseJob(input({ platforms: ["web"], projectId: "onda-rel-web" }), {
      ownerId: OWNER_A,
    });
    assert.equal((ok as { status: string }).status, "ok");
    assert.match((ok as { tracks: { web?: { artifact?: string } } }).tracks.web?.artifact || "", /\/sito\//);
  });

  it("returns a clear missing-record error", async () => {
    const job = await createReleaseJob(
      input({ bundleId: "it.fenix.missing", platforms: ["ios"], projectId: "onda-rel-miss" }),
      { ownerId: OWNER_A },
    );
    assert.equal((job as { status: string }).status, "err");
    assert.match((job as { error?: string }).error || "", /record App Store Connect/i);
  });

  it("resumes after an interrupted sign without duplicating upload", async () => {
    let uploads = 0;
    let signs = 0;
    const ios: ReleaseAdapter = {
      platform: "ios",
      connected: () => false,
      async run(step, _job, track) {
        if (step === "sign") {
          signs += 1;
          if (signs === 1) return { ok: false, step, fixture: true, error: "firma interrotta" };
          return { ok: true, step, fixture: true };
        }
        if (step === "upload") {
          if (track.uploads >= 1) return { ok: true, step, fixture: true, artifact: track.artifact };
          uploads += 1;
          return { ok: true, step, fixture: true, artifact: "ipa" };
        }
        return { ok: true, step, fixture: true };
      },
    };
    setReleaseAdaptersForTest({ ios });
    const first = await createReleaseJob(
      input({ projectId: "onda-rel-resume", bundleId: "it.fenix.resume" }),
      { ownerId: OWNER_A },
    );
    assert.equal((first as { status: string }).status, "err");
    const resumed = await resumeReleaseJob((first as { id: string }).id, { ownerId: OWNER_A });
    assert.equal((resumed as { status: string }).status, "ok");
    assert.equal(uploads, 1);
  });

  it("other owner cannot read the job", async () => {
    const job = await createReleaseJob(input({ projectId: "onda-rel-own", platforms: ["ios"] }), {
      ownerId: OWNER_A,
    });
    const req = new Request("https://fenix.example/api/release/" + (job as { id: string }).id, {
      headers: { [OWNER_HEADER]: OWNER_B },
    });
    const res = await handleReleaseItem(req, (job as { id: string }).id);
    assert.equal(res.status, 403);
  });

  it("idempotency key is stable for the same html", () => {
    const a = releaseIdempotencyKey({
      ownerHash: "aa",
      projectId: PID,
      platforms: ["ios", "web"],
      htmlHash: "h1",
      bundleId: "it.fenix.onda",
      packageName: "it.fenix.onda",
    });
    const b = releaseIdempotencyKey({
      ownerHash: "aa",
      projectId: PID,
      platforms: ["web", "ios"],
      htmlHash: "h1",
      bundleId: "it.fenix.onda",
      packageName: "it.fenix.onda",
    });
    assert.equal(a, b);
  });

  it("public job has no ownerHash and no secrets", async () => {
    const pem = "-----BEGIN PRIVATE KEY-----\nSECRET\n-----END PRIVATE KEY-----";
    const ios: ReleaseAdapter = {
      platform: "ios",
      connected: () => false,
      async run() {
        return { ok: false, step: "preflight", fixture: true, error: `fallito ${pem}` };
      },
    };
    setReleaseAdaptersForTest({ ios });
    const job = await createReleaseJob(input({ projectId: "onda-rel-sec" }), { ownerId: OWNER_A });
    const raw = JSON.stringify(job);
    assert.doesNotMatch(raw, /BEGIN PRIVATE KEY/);
    assert.doesNotMatch(raw, /ownerHash/);
    assert.doesNotMatch(raw, new RegExp(OWNER_A));
    assert.match((job as { error?: string }).error || "", /redacted|fallito/);
  });
});

describe("release http", () => {
  const prevRel = process.env.FENIX_RELEASE_DIR;
  const prevPub = process.env.FENIX_PUBLISHED_DIR;
  before(() => {
    process.env.FENIX_RELEASE_DIR = mkdtempSync(join(tmpdir(), "fenix-relh-"));
    process.env.FENIX_PUBLISHED_DIR = mkdtempSync(join(tmpdir(), "fenix-pubh-"));
    process.env.FENIX_RELEASE_FIXTURE = "1";
    delete process.env.NETLIFY;
  });
  after(() => {
    if (prevRel === undefined) delete process.env.FENIX_RELEASE_DIR;
    else process.env.FENIX_RELEASE_DIR = prevRel;
    if (prevPub === undefined) delete process.env.FENIX_PUBLISHED_DIR;
    else process.env.FENIX_PUBLISHED_DIR = prevPub;
  });

  it("GET lists accounts without secrets; POST without owner is 401", async () => {
    const acc = await handleReleaseCollection(new Request("https://fenix.example/api/release"));
    assert.equal(acc.status, 200);
    const body = (await acc.json()) as { ios: { needs: string[] }; reviewNote: string };
    assert.match(body.reviewNote, /review/i);
    assert.equal(JSON.stringify(body).includes("BEGIN"), false);
    assert.equal(JSON.stringify(body).includes("APPLE_PRIVATE_KEY"), false);
    assert.equal(JSON.stringify(body).includes("GOOGLE_PLAY_SERVICE_ACCOUNT"), false);
    const anon = await handleReleaseCollection(
      new Request("https://fenix.example/api/release", {
        method: "POST",
        body: JSON.stringify(input()),
      }),
    );
    assert.equal(anon.status, 401);
  });

  it("POST valid site+ios returns 201 and GET reattaches", async () => {
    const created = await handleReleaseCollection(
      new Request("https://fenix.example/api/release", {
        method: "POST",
        headers: { "content-type": "application/json", [OWNER_HEADER]: OWNER_A },
        body: JSON.stringify(input({ projectId: "onda-rel-http", platforms: ["web", "ios", "android"] })),
      }),
    );
    assert.equal(created.status, 201, await created.clone().text());
    const job = (await created.json()) as { id: string; status: string; html?: string; ownerHash?: string };
    assert.equal(job.status, "ok");
    assert.equal(job.html, undefined);
    assert.equal(job.ownerHash, undefined);
    const got = await handleReleaseItem(
      new Request("https://fenix.example/api/release/" + job.id, {
        headers: { [OWNER_HEADER]: OWNER_A },
      }),
      job.id,
    );
    assert.equal(got.status, 200);
    const live = (await got.json()) as { id: string; status: string };
    assert.equal(live.id, job.id);
    assert.equal(live.status, "ok");
  });
});

describe("release accounts in production without keys", () => {
  it("blocks ios when fixture is off", async () => {
    const prev = {
      NODE_ENV: process.env.NODE_ENV,
      FIX: process.env.FENIX_RELEASE_FIXTURE,
      NETLIFY: process.env.NETLIFY,
    };
    process.env.NODE_ENV = "production";
    process.env.NETLIFY = "1";
    delete process.env.FENIX_RELEASE_FIXTURE;
    delete process.env.APPLE_PRIVATE_KEY;
    try {
      const acc = accountsSnapshot();
      assert.equal(acc.fixture, false);
      assert.equal(acc.ios.connected, false);
      assert.match(acc.ios.hint, /App Manager|Admin/);
    } finally {
      process.env.NODE_ENV = prev.NODE_ENV;
      if (prev.FIX === undefined) delete process.env.FENIX_RELEASE_FIXTURE;
      else process.env.FENIX_RELEASE_FIXTURE = prev.FIX;
      if (prev.NETLIFY === undefined) delete process.env.NETLIFY;
      else process.env.NETLIFY = prev.NETLIFY;
    }
  });
});

describe("store api preflight", () => {
  afterEach(() => setReleaseFetchForTest(null));

  it("apple JWT talks to App Store Connect and finds the app", async () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    let sawAuth = false;
    setReleaseFetchForTest(async (input, init) => {
      const url = String(input);
      assert.match(url, /api\.appstoreconnect\.apple\.com\/v1\/apps/);
      assert.match(url, /it\.fenix\.onda/);
      const header = String((init?.headers as { Authorization?: string })?.Authorization || "");
      assert.match(header, /^Bearer eyJ/);
      sawAuth = true;
      assert.doesNotMatch(header, /BEGIN PRIVATE KEY/);
      return Response.json({ data: [{ id: "app1", attributes: { bundleId: "it.fenix.onda" } }] });
    });
    const check = await applePreflight(
      { issuerId: "iss-123456789", keyId: "KEYID12345", privateKey: pem },
      "it.fenix.onda",
    );
    assert.equal(check.ok, true);
    assert.equal(sawAuth, true);
  });

  it("apple 401 explains App Manager role and redacts the token", async () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    setReleaseFetchForTest(async () => new Response("no", { status: 401 }));
    const check = await applePreflight(
      { issuerId: "iss-123456789", keyId: "KEYID12345", privateKey: pem },
      "it.fenix.onda",
    );
    assert.equal(check.ok, false);
    if (!check.ok) {
      assert.match(check.error, /App Manager|Admin/);
      assert.doesNotMatch(check.error, /BEGIN/);
      assert.doesNotMatch(check.error, /eyJ/);
    }
  });

  it("google missing app is a clear Play Console error", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const json = JSON.stringify({
      client_email: "play@fenix.test",
      private_key: pem,
    });
    setReleaseFetchForTest(async (input) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return Response.json({ access_token: "ya29.not-a-real-token-value" });
      }
      return new Response("missing", { status: 404 });
    });
    const check = await googlePreflight(json, "it.fenix.onda");
    assert.equal(check.ok, false);
    if (!check.ok) {
      assert.match(check.error, /Play Console/);
      assert.match(check.error, /it\.fenix\.onda/);
      assert.doesNotMatch(check.error, /BEGIN PRIVATE KEY/);
      assert.doesNotMatch(check.error, /ya29/);
    }
  });

  it("rejects a service account that is not JSON without echoing it", () => {
    const parsed = parseGoogleServiceAccount("not-json-and-not-base64");
    assert.equal("error" in parsed, true);
    if ("error" in parsed) {
      assert.match(parsed.error, /service account/i);
      assert.doesNotMatch(parsed.error, /not-json-and-not-base64/);
    }
  });
});
