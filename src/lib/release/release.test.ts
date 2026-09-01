import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { generateKeyPairSync } from "node:crypto";
import { ensureFenixAdapter } from "../projects/fenix-adapter.ts";
import { OWNER_HEADER } from "../projects/publish-owner.ts";
import { setReleaseAdaptersForTest, type ReleaseAdapter } from "./adapters.ts";
import { runAndroidStep } from "./android.ts";
import { netlifyCreateDeploy, netlifyFindOrCreateSite, netlifyListDeploys } from "./deploy-api.ts";
import { createReleaseJob, jobIdFromKey, releaseIdempotencyKey, resetReleaseCreatesForTest, resumeReleaseJob } from "./engine.ts";
import { handleReleaseCollection, handleReleaseItem } from "./http.ts";
import { suggestedBundleId, validateBundleId, validatePackageName } from "./ids.ts";
import { runIosStep } from "./ios.ts";
import { accountsSnapshot, gateHtml } from "./preflight.ts";
import { redactSecrets } from "./redact.ts";
import { fixtureCommand, setReleaseCommandRunnerForTest } from "./runner.ts";
import {
  applePreflight,
  googlePreflight,
  parseGoogleServiceAccount,
  setReleaseFetchForTest,
} from "./store-api.ts";
import type { PersistTrack, StoredReleaseJob, TrackState } from "./types.ts";
import { runWebStep } from "./web.ts";
import { claimReleaseKey, resetReleaseClaimsForTest, setReleaseBlobsForTest } from "./store.ts";

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
  afterEach(() => {
    setReleaseAdaptersForTest(null);
    resetReleaseCreatesForTest();
    resetReleaseClaimsForTest();
  });

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

  it("two concurrent POSTs produce one job and one upload", async () => {
    let uploads = 0;
    const ios: ReleaseAdapter = {
      platform: "ios",
      connected: () => false,
      async run(step) {
        if (step === "upload") {
          uploads += 1;
          return { ok: true, step, fixture: true, artifact: "asc:conc" };
        }
        return { ok: true, step, fixture: true };
      },
    };
    setReleaseAdaptersForTest({ ios });
    const body = input({ projectId: "onda-rel-conc", bundleId: "it.fenix.conc" });
    const [a, b] = await Promise.all([
      createReleaseJob(body, { ownerId: OWNER_A }),
      createReleaseJob(body, { ownerId: OWNER_A }),
    ]);
    assert.equal("id" in a && "id" in b, true);
    assert.equal((a as { id: string }).id, (b as { id: string }).id);
    assert.equal(uploads, 1);
    const statusA = (a as { status: string }).status;
    const statusB = (b as { status: string }).status;
    assert.equal(statusA === "ok" || statusB === "ok" || statusA === "run" || statusB === "run", true);
    if (statusA !== "ok" && statusB !== "ok") {
      const done = await resumeReleaseJob((a as { id: string }).id, { ownerId: OWNER_A });
      assert.equal((done as { status: string }).status, "ok");
    }
    assert.equal(uploads, 1);
  });

  it("crash after persist does not duplicate upload on resume", async () => {
    let uploads = 0;
    const ios: ReleaseAdapter = {
      platform: "ios",
      connected: () => false,
      async run(step, _job, track, persist) {
        if (step === "upload") {
          if (track.provider?.uploadId) {
            return {
              ok: true,
              step,
              fixture: true,
              artifact: track.provider.uploadId,
              reconciled: true,
            };
          }
          uploads += 1;
          await persist({ provider: { ...track.provider, uploadId: "asc:crash-1" } });
          throw new Error("crash after provider success");
        }
        return { ok: true, step, fixture: true };
      },
    };
    setReleaseAdaptersForTest({ ios });
    const first = await createReleaseJob(
      input({ projectId: "onda-rel-crash", bundleId: "it.fenix.crash" }),
      { ownerId: OWNER_A },
    );
    assert.equal((first as { status: string }).status, "err");
    assert.equal((first as { tracks: { ios?: { provider?: { uploadId?: string } } } }).tracks.ios?.provider?.uploadId, "asc:crash-1");
    assert.equal(uploads, 1);
    const resumed = await resumeReleaseJob((first as { id: string }).id, { ownerId: OWNER_A });
    assert.equal((resumed as { status: string }).status, "ok");
    assert.equal(uploads, 1);
    assert.match((resumed as { log: string[] }).log.join("\n"), /già fatto|Pronto|TestFlight/);
  });

  it("processing pending returns without spinning", async () => {
    const started = Date.now();
    const ios: ReleaseAdapter = {
      platform: "ios",
      connected: () => false,
      async run(step) {
        if (step === "processing") return { ok: true, step, fixture: true, pending: true };
        return { ok: true, step, fixture: true };
      },
    };
    setReleaseAdaptersForTest({ ios });
    const job = await createReleaseJob(
      input({ projectId: "onda-rel-pend", bundleId: "it.fenix.pend" }),
      { ownerId: OWNER_A },
    );
    assert.ok(Date.now() - started < 4000);
    assert.equal((job as { status: string }).status, "run");
    assert.equal((job as { tracks: { ios?: { step?: string } } }).tracks.ios?.step, "processing");
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

  it("two concurrent HTTP POSTs share one id", async () => {
    const body = JSON.stringify(input({ projectId: "onda-rel-http2", platforms: ["web"] }));
    const req = () =>
      handleReleaseCollection(
        new Request("https://fenix.example/api/release", {
          method: "POST",
          headers: { "content-type": "application/json", [OWNER_HEADER]: OWNER_A },
          body,
        }),
      );
    const [r1, r2] = await Promise.all([req(), req()]);
    assert.equal(r1.status, 201);
    assert.equal(r2.status === 201 || r2.status === 200, true);
    const a = (await r1.json()) as { id: string };
    const b = (await r2.json()) as { id: string };
    assert.equal(a.id, b.id);
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

function sampleJob(over: Partial<StoredReleaseJob> = {}): StoredReleaseJob {
  const now = Date.now();
  return {
    id: over.id || "job-sample-01",
    projectId: over.projectId || "onda-rel-pipe",
    ownerHash: "hash",
    platforms: over.platforms || ["ios"],
    status: "run",
    step: "build",
    log: [],
    tracks: {
      web: { platform: "web", step: "connect", status: "queued", fixture: false, uploads: 0 },
      ios: { platform: "ios", step: "build", status: "run", fixture: false, uploads: 0 },
      android: { platform: "android", step: "build", status: "run", fixture: false, uploads: 0 },
    },
    config: {
      bundleId: "it.fenix.onda",
      packageName: "it.fenix.onda",
      siteName: "Onda",
      appName: "Onda",
    },
    htmlHash: "abcd1234abcd1234",
    idempotencyKey: "a".repeat(32),
    createdAt: now,
    updatedAt: now,
    kind: "site",
    name: "Onda",
    tagline: "",
    summary: "",
    html: ADAPTED,
    palette: PALETTE,
    ...over,
  };
}

function persistInto(track: TrackState): PersistTrack {
  return async (patch) => {
    Object.assign(track, patch);
    track.provider = { ...track.provider, ...patch.provider };
    return track;
  };
}

describe("release real pipelines behind mocks", () => {
  const prevRel = process.env.FENIX_RELEASE_DIR;
  const prevPub = process.env.FENIX_PUBLISHED_DIR;
  const rel = mkdtempSync(join(tmpdir(), "fenix-pipe-"));
  const pub = mkdtempSync(join(tmpdir(), "fenix-pubp-"));

  before(() => {
    process.env.FENIX_RELEASE_DIR = rel;
    process.env.FENIX_PUBLISHED_DIR = pub;
    process.env.FENIX_RELEASE_FIXTURE = "1";
    delete process.env.NETLIFY;
  });
  after(() => {
    setReleaseCommandRunnerForTest(null);
    setReleaseFetchForTest(null);
    if (prevRel === undefined) delete process.env.FENIX_RELEASE_DIR;
    else process.env.FENIX_RELEASE_DIR = prevRel;
    if (prevPub === undefined) delete process.env.FENIX_PUBLISHED_DIR;
    else process.env.FENIX_PUBLISHED_DIR = prevPub;
  });
  afterEach(() => {
    setReleaseCommandRunnerForTest(null);
    setReleaseFetchForTest(null);
    delete process.env.NETLIFY_AUTH_TOKEN;
  });

  it("fixture xcodebuild writes an xcarchive and altool is invoked", async () => {
    const job = sampleJob({ id: "job-ios-fix" });
    const track: TrackState = {
      platform: "ios",
      step: "build",
      status: "run",
      fixture: true,
      uploads: 0,
    };
    const built = await runIosStep("build", job, track, persistInto(track), {
      fixture: true,
      creds: null,
    });
    assert.equal(built.ok, true);
    assert.equal(existsSync(join(rel, "work", job.id, "ios", "it.fenix.onda.xcarchive", "Info.plist")), true);
    track.provider = { ...track.provider, archivePath: built.artifact };
    const signed = await runIosStep("sign", job, track, persistInto(track), {
      fixture: true,
      creds: null,
    });
    assert.equal(signed.ok, true);
    assert.equal(existsSync(join(rel, "work", job.id, "ios", "export", "Fenix.ipa")), true);
    let altool = 0;
    setReleaseCommandRunnerForTest(async (file, args, opts) => {
      if (file === "xcrun" && args[0] === "altool") altool += 1;
      return fixtureCommand(file, args, opts);
    });
    const uploaded = await runIosStep("upload", job, track, persistInto(track), {
      fixture: true,
      creds: null,
      commands: async (file, args, opts) => {
        if (file === "xcrun" && args[0] === "altool") altool += 1;
        return fixtureCommand(file, args, opts);
      },
    });
    assert.equal(uploaded.ok, true);
    assert.equal(altool, 1);
    const again = await runIosStep("upload", job, track, persistInto(track), {
      fixture: true,
      creds: null,
    });
    assert.equal(again.reconciled, true);
    assert.equal(altool, 1);
  });

  it("refuses to sign iOS without Team ID when not fixture", async () => {
    const job = sampleJob({ id: "job-ios-team" });
    const track: TrackState = {
      platform: "ios",
      step: "sign",
      status: "run",
      fixture: false,
      uploads: 0,
      provider: { archivePath: "/tmp/no.xcarchive" },
    };
    const signed = await runIosStep("sign", job, track, persistInto(track), {
      fixture: false,
      creds: { issuerId: "iss-123456789", keyId: "KEYID12345", privateKey: "not-a-key" },
    });
    assert.equal(signed.ok, false);
    assert.match(signed.error || "", /Team ID/);
  });

  it("fixture gradle writes an aab and jarsigner is invoked", async () => {
    const job = sampleJob({ id: "job-and-fix", platforms: ["android"] });
    const track: TrackState = {
      platform: "android",
      step: "build",
      status: "run",
      fixture: true,
      uploads: 0,
    };
    const built = await runAndroidStep("build", job, track, persistInto(track), {
      fixture: true,
      serviceJson: null,
    });
    assert.equal(built.ok, true);
    assert.equal(
      existsSync(join(rel, "work", job.id, "android", "app/build/outputs/bundle/release/app-release.aab")),
      true,
    );
    let signedCalls = 0;
    const signed = await runAndroidStep("sign", job, track, persistInto(track), {
      fixture: true,
      serviceJson: null,
      commands: async (file, args, opts) => {
        if (file === "jarsigner") signedCalls += 1;
        return fixtureCommand(file, args, opts);
      },
    });
    assert.equal(signed.ok, true);
    assert.equal(signedCalls, 1);
  });

  it("refuses Android sign without keystore when not fixture", async () => {
    const job = sampleJob({ id: "job-and-key", platforms: ["android"] });
    const track: TrackState = {
      platform: "android",
      step: "sign",
      status: "run",
      fixture: false,
      uploads: 0,
      provider: { aabPath: "/tmp/app.aab" },
    };
    const signed = await runAndroidStep("sign", job, track, persistInto(track), {
      fixture: false,
      serviceJson: "{}",
    });
    assert.equal(signed.ok, false);
    assert.match(signed.error || "", /keystore/i);
  });

  it("Netlify create site + zip deploy + poll ready, no second zip", async () => {
    process.env.NETLIFY_AUTH_TOKEN = "nfp_testtokenvaluexx";
    let deploys = 0;
    let sites = 0;
    setReleaseFetchForTest(async (input, init) => {
      const url = String(input);
      const method = String(init?.method || "GET").toUpperCase();
      if (url.includes("/api/v1/sites/") && url.includes("/deploys") && method === "POST") {
        deploys += 1;
        return Response.json({ id: "dep1", state: "uploaded" });
      }
      if (url.includes("/api/v1/sites") && method === "POST") {
        sites += 1;
        return Response.json({ id: "site1", name: "fenix-onda" });
      }
      if (url.includes("/api/v1/sites?") || url.endsWith("/api/v1/sites")) {
        return Response.json([]);
      }
      if (url.includes("/api/v1/deploys/dep1")) {
        return Response.json({ id: "dep1", state: "ready" });
      }
      if (url.includes("/api/v1/sites/site1")) {
        return Response.json({ id: "site1" });
      }
      return new Response("no", { status: 404 });
    });
    const job = sampleJob({ id: "job-web-net", platforms: ["web"], projectId: "onda-rel-netlify" });
    const track: TrackState = {
      platform: "web",
      step: "upload",
      status: "run",
      fixture: false,
      uploads: 0,
    };
    const first = await runWebStep("upload", job, track, persistInto(track), { ownerId: OWNER_A });
    assert.equal(first.ok, true, first.error);
    assert.equal(sites, 1);
    assert.equal(deploys, 1);
    assert.equal(track.provider?.deployId, "dep1");
    const second = await runWebStep("upload", job, track, persistInto(track), { ownerId: OWNER_A });
    assert.equal(second.reconciled, true);
    assert.equal(deploys, 1);
    const processing = await runWebStep("processing", job, track, persistInto(track), {
      ownerId: OWNER_A,
    });
    assert.equal(processing.ok, true);
    assert.equal(processing.pending, undefined);
  });

  it("Play edits insert/upload/commit is skipped when edit already exists", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const json = JSON.stringify({ client_email: "play@fenix.test", private_key: pem });
    let inserts = 0;
    let uploads = 0;
    setReleaseFetchForTest(async (input, init) => {
      const url = String(input);
      const method = String(init?.method || "GET").toUpperCase();
      if (url.includes("oauth2.googleapis.com/token")) {
        return Response.json({ access_token: "ya29.not-a-real-token-value" });
      }
      if (url.endsWith("/edits") && method === "POST") {
        inserts += 1;
        return Response.json({ id: "edit-1" });
      }
      if (url.includes("/bundles") && method === "POST") {
        uploads += 1;
        return Response.json({ versionCode: 7 });
      }
      if (url.includes("/tracks/internal") && method === "PUT") {
        return Response.json({ track: "internal" });
      }
      if (url.includes(":commit") && method === "POST") {
        return Response.json({ id: "edit-1" });
      }
      return Response.json({});
    });
    await fixtureCommand("gradle", ["bundleRelease"], {
      cwd: join(rel, "work", "job-play", "android"),
    });
    const aab = join(rel, "work", "job-play", "android", "app/build/outputs/bundle/release/app-release.aab");
    const job = sampleJob({ id: "job-play", platforms: ["android"] });
    const track: TrackState = {
      platform: "android",
      step: "upload",
      status: "run",
      fixture: false,
      uploads: 0,
      provider: { aabPath: aab, signedAabPath: aab },
    };
    const first = await runAndroidStep("upload", job, track, persistInto(track), {
      fixture: false,
      serviceJson: json,
      keystorePath: "/tmp/upload.keystore",
    });
    assert.equal(first.ok, true, first.error);
    assert.equal(inserts, 1);
    assert.equal(uploads, 1);
    const second = await runAndroidStep("upload", job, track, persistInto(track), {
      fixture: false,
      serviceJson: json,
      keystorePath: "/tmp/upload.keystore",
    });
    assert.equal(second.reconciled, true);
    assert.equal(inserts, 1);
    assert.equal(uploads, 1);
  });

  it("find-or-create site reuses an existing Netlify site", async () => {
    let created = 0;
    setReleaseFetchForTest(async (input, init) => {
      const url = String(input);
      const method = String(init?.method || "GET").toUpperCase();
      if (url.includes("/api/v1/sites") && method === "POST") {
        created += 1;
        return Response.json({ id: "new" });
      }
      if (url.includes("/api/v1/deploys/dep-old")) {
        return Response.json({ id: "dep-old", state: "ready" });
      }
      if (url.includes("/api/v1/sites")) {
        return Response.json([{ id: "site-existing", name: "fenix-onda" }]);
      }
      return new Response("no", { status: 404 });
    });
    const found = await netlifyFindOrCreateSite("nfp_testtokenvaluexx", "fenix-onda");
    assert.equal(found.ok, true);
    if (found.ok) assert.equal(found.id, "site-existing");
    assert.equal(created, 0);
    const deploy = await netlifyCreateDeploy(
      "nfp_testtokenvaluexx",
      "site-existing",
      new Uint8Array([1, 2, 3]),
      "t1",
      "dep-old",
    );
    assert.equal(deploy.ok, true);
    if (deploy.ok) assert.equal(deploy.id, "dep-old");
  });

  it("crash after altool success before uploadId write is reconciled without a second altool", async () => {
    let altool = 0;
    const job = sampleJob({ id: "job-ios-inflight" });
    const track: TrackState = {
      platform: "ios",
      step: "upload",
      status: "run",
      fixture: true,
      uploads: 0,
      provider: {
        ipaPath: join(rel, "work", job.id, "ios", "export", "Fenix.ipa"),
        intentId: `${job.id}:ios:upload`,
        inflight: "upload",
      },
    };
    const again = await runIosStep("upload", job, track, persistInto(track), {
      fixture: true,
      creds: null,
      commands: async (file, args, opts) => {
        if (file === "xcrun" && args[0] === "altool") altool += 1;
        return fixtureCommand(file, args, opts);
      },
    });
    assert.equal(again.ok, true);
    assert.equal(again.reconciled, true);
    assert.equal(altool, 0);
    assert.match(track.provider?.uploadId || "", /asc:/);
  });

  it("Play commit already-committed is success, not a second edit", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const json = JSON.stringify({ client_email: "play@fenix.test", private_key: pem });
    let commits = 0;
    let inserts = 0;
    setReleaseFetchForTest(async (input, init) => {
      const url = String(input);
      const method = String(init?.method || "GET").toUpperCase();
      if (url.includes("oauth2.googleapis.com/token")) {
        return Response.json({ access_token: "ya29.not-a-real-token-value" });
      }
      if (url.endsWith("/edits") && method === "POST") {
        inserts += 1;
        return Response.json({ id: "edit-2" });
      }
      if (url.includes("/bundles") && method === "POST") {
        return Response.json({ versionCode: 9 });
      }
      if (url.includes("/tracks/internal") && method === "PUT") {
        return new Response("The edit is no longer valid because it has already been committed", {
          status: 400,
        });
      }
      if (url.includes(":commit") && method === "POST") {
        commits += 1;
        return new Response("already committed", { status: 400 });
      }
      return Response.json({});
    });
    const aab = join(rel, "work", "job-play2", "android", "app/build/outputs/bundle/release/app-release.aab");
    await fixtureCommand("gradle", ["bundleRelease"], {
      cwd: join(rel, "work", "job-play2", "android"),
    });
    const job = sampleJob({ id: "job-play2", platforms: ["android"] });
    const track: TrackState = {
      platform: "android",
      step: "upload",
      status: "run",
      fixture: false,
      uploads: 0,
      provider: { aabPath: aab, signedAabPath: aab, editId: "edit-2", versionCode: "9" },
    };
    const first = await runAndroidStep("upload", job, track, persistInto(track), {
      fixture: false,
      serviceJson: json,
      keystorePath: "/tmp/upload.keystore",
    });
    assert.equal(first.ok, true, first.error);
    assert.equal(inserts, 0);
    assert.match(track.provider?.uploadId || "", /play-internal/);
  });

  it("Netlify lists deploys by title after a crash before persist", async () => {
    process.env.NETLIFY_AUTH_TOKEN = "nfp_testtokenvaluexx";
    let deploys = 0;
    setReleaseFetchForTest(async (input, init) => {
      const url = String(input);
      const method = String(init?.method || "GET").toUpperCase();
      if (url.includes("/deploys") && method === "POST") {
        deploys += 1;
        return Response.json({ id: "dep-new", state: "ready" });
      }
      if (url.includes("/deploys") && method === "GET") {
        return Response.json([{ id: "dep-old", title: "job-web-crash:abcd", state: "ready" }]);
      }
      if (url.includes("/api/v1/sites") && method === "POST") {
        return Response.json({ id: "site-crash" });
      }
      if (url.includes("/api/v1/sites")) {
        return Response.json([{ id: "site-crash", name: "fenix-onda" }]);
      }
      return new Response("no", { status: 404 });
    });
    const listed = await netlifyListDeploys("nfp_testtokenvaluexx", "site-crash", "job-web-crash:abcd");
    assert.equal(listed.ok, true);
    if (listed.ok) assert.equal(listed.id, "dep-old");
    const job = sampleJob({
      id: "job-web-crash",
      platforms: ["web"],
      projectId: "onda-rel-netlify-crash",
    });
    job.htmlHash = "abcd";
    const track: TrackState = {
      platform: "web",
      step: "upload",
      status: "run",
      fixture: false,
      uploads: 0,
      provider: { siteId: "site-crash", intentId: "job-web-crash:abcd" },
    };
    const first = await runWebStep("upload", job, track, persistInto(track), { ownerId: OWNER_A });
    assert.equal(first.ok, true, first.error);
    assert.equal(first.reconciled, true);
    assert.equal(deploys, 0);
    assert.equal(track.provider?.deployId, "dep-old");
  });

  it("in-process + blob claim: two ids, one winner", async () => {
    resetReleaseClaimsForTest();
    const mem = new Map<string, unknown>();
    setReleaseBlobsForTest({
      async get(key) {
        return mem.get(key) ?? null;
      },
      async setJSON(key, value) {
        mem.set(key, value);
      },
    });
    const key = "a".repeat(64);
    const [a, b] = await Promise.all([
      claimReleaseKey(key, "11111111-1111-4111-8111-111111111111"),
      claimReleaseKey(key, "22222222-2222-4222-8222-222222222222"),
    ]);
    assert.equal(a.id, b.id);
    assert.equal([a, b].filter((x) => x.won).length, 1);
    resetReleaseClaimsForTest();
  });

  it("Play lists existing bundles after crash and does not POST a second AAB", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const json = JSON.stringify({ client_email: "play@fenix.test", private_key: pem });
    let uploads = 0;
    let lists = 0;
    setReleaseFetchForTest(async (input, init) => {
      const url = String(input);
      const method = String(init?.method || "GET").toUpperCase();
      if (url.includes("oauth2.googleapis.com/token")) {
        return Response.json({ access_token: "ya29.not-a-real-token-value" });
      }
      if (url.endsWith("/edits") && method === "POST") {
        return Response.json({ id: "edit-3" });
      }
      if (url.includes("/bundles") && method === "GET") {
        lists += 1;
        return Response.json({ bundles: [{ versionCode: 11 }] });
      }
      if (url.includes("/bundles") && method === "POST") {
        uploads += 1;
        return Response.json({ versionCode: 12 });
      }
      if (url.includes("/tracks/internal") && method === "PUT") {
        return Response.json({ track: "internal" });
      }
      if (url.includes(":commit") && method === "POST") {
        return Response.json({ id: "edit-3" });
      }
      return Response.json({});
    });
    const aab = join(
      rel,
      "work",
      "job-play3",
      "android",
      "app/build/outputs/bundle/release/app-release.aab",
    );
    await fixtureCommand("gradle", ["bundleRelease"], {
      cwd: join(rel, "work", "job-play3", "android"),
    });
    const job = sampleJob({ id: "job-play3", platforms: ["android"] });
    const track: TrackState = {
      platform: "android",
      step: "upload",
      status: "run",
      fixture: false,
      uploads: 0,
      provider: {
        aabPath: aab,
        signedAabPath: aab,
        editId: "edit-3",
        inflight: "play-upload",
      },
    };
    const first = await runAndroidStep("upload", job, track, persistInto(track), {
      fixture: false,
      serviceJson: json,
      keystorePath: "/tmp/upload.keystore",
    });
    assert.equal(first.ok, true, first.error);
    assert.equal(lists, 1);
    assert.equal(uploads, 0);
    assert.equal(track.provider?.versionCode, "11");
  });

  it("Play inflight commit does not insert a second edit", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const json = JSON.stringify({ client_email: "play@fenix.test", private_key: pem });
    let inserts = 0;
    let uploads = 0;
    setReleaseFetchForTest(async (input, init) => {
      const url = String(input);
      const method = String(init?.method || "GET").toUpperCase();
      if (url.includes("oauth2.googleapis.com/token")) {
        return Response.json({ access_token: "ya29.not-a-real-token-value" });
      }
      if (url.endsWith("/edits") && method === "POST") {
        inserts += 1;
        return Response.json({ id: "edit-4" });
      }
      if (url.includes("/bundles") && method === "POST") {
        uploads += 1;
        return Response.json({ versionCode: 13 });
      }
      if (url.includes("/tracks/internal") && method === "PUT") {
        return new Response("already committed", { status: 400 });
      }
      if (url.includes(":commit") && method === "POST") {
        return new Response("already committed", { status: 400 });
      }
      return Response.json({});
    });
    const aab = join(
      rel,
      "work",
      "job-play4",
      "android",
      "app/build/outputs/bundle/release/app-release.aab",
    );
    await fixtureCommand("gradle", ["bundleRelease"], {
      cwd: join(rel, "work", "job-play4", "android"),
    });
    const job = sampleJob({ id: "job-play4", platforms: ["android"] });
    const track: TrackState = {
      platform: "android",
      step: "upload",
      status: "run",
      fixture: false,
      uploads: 0,
      provider: {
        aabPath: aab,
        signedAabPath: aab,
        editId: "edit-4",
        versionCode: "13",
        inflight: "play-commit",
      },
    };
    const first = await runAndroidStep("upload", job, track, persistInto(track), {
      fixture: false,
      serviceJson: json,
      keystorePath: "/tmp/upload.keystore",
    });
    assert.equal(first.ok, true, first.error);
    assert.equal(first.reconciled, true);
    assert.equal(inserts, 0);
    assert.equal(uploads, 0);
    assert.match(track.provider?.uploadId || "", /play-internal/);
  });

  it("job id is derived from the idempotency key", () => {
    const key = releaseIdempotencyKey({
      ownerHash: "aa",
      projectId: "onda-rel-01",
      platforms: ["ios"],
      htmlHash: "h1",
      bundleId: "it.fenix.onda",
      packageName: "it.fenix.onda",
    });
    const id = jobIdFromKey(key);
    assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-8[a-f0-9]{3}-[a-f0-9]{12}$/);
    assert.equal(jobIdFromKey(key), id);
  });

  it("non-hex Idempotency header does not replace the html-hash key", async () => {
    const body = input({ projectId: "onda-rel-hdr", platforms: ["web"] });
    const first = await createReleaseJob(body, {
      ownerId: OWNER_A,
      idempotencyKey: "onda-rel-hdr:web",
    });
    const second = await createReleaseJob(
      { ...body, html: ADAPTED.replace("</body>", "<!--v2--></body>") },
      { ownerId: OWNER_A, idempotencyKey: "onda-rel-hdr:web" },
    );
    assert.equal("id" in first && "id" in second, true);
    assert.notEqual((first as { id: string }).id, (second as { id: string }).id);
  });
});

