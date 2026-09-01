import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { generateKeyPairSync } from "node:crypto";
import { ensureFenixAdapter } from "../projects/fenix-adapter.ts";
import { appleListLatestBuild, playGetInternalTrack, setReleaseFetchForTest } from "./deploy-api.ts";
import { runAndroidStep } from "./android.ts";
import { runIosStep } from "./ios.ts";
import { materializeAndroid, materializeIos, validateAndroidProject, validateIosProject } from "./native.ts";
import { fixtureCommand } from "./runner.ts";
import {
  claimReleaseKey,
  createReleaseSqlForTest,
  createReleaseStore,
  resetReleaseClaimsForTest,
  setReleaseBlobsForTest,
  setReleaseSqlForTest,
} from "./store.ts";
import type { PersistTrack, StoredReleaseJob, TrackState } from "./types.ts";
import { runWebStep } from "./web.ts";
import { redactArgs } from "./redact.ts";
import { shouldDispatchNative } from "./dispatch.ts";

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

function sampleJob(over: Partial<StoredReleaseJob> = {}): StoredReleaseJob {
  const now = over.createdAt || 1_720_000_000_000;
  return {
    id: over.id || "job-fase2-01",
    projectId: over.projectId || "onda-fase2",
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
      iosBuildNumber: "1720000000",
      androidVersionCode: 1720000000,
      versionName: "1.0",
    },
    htmlHash: "abcd1234abcd1234",
    idempotencyKey: "b".repeat(32),
    createdAt: now,
    updatedAt: now,
    kind: "site",
    name: "Onda",
    tagline: "",
    summary: "",
    html: ADAPTED,
    palette: PALETTE,
    version: 1,
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

describe("fase2 iOS project is buildable", () => {
  const prevRel = process.env.FENIX_RELEASE_DIR;
  const rel = mkdtempSync(join(tmpdir(), "fenix-fase2-ios-"));
  before(() => {
    process.env.FENIX_RELEASE_DIR = rel;
  });
  after(() => {
    if (prevRel === undefined) delete process.env.FENIX_RELEASE_DIR;
    else process.env.FENIX_RELEASE_DIR = prevRel;
    rmSync(rel, { recursive: true, force: true });
  });

  it("rejects a comment-only pbxproj", () => {
    const bad = validateIosProject(
      {
        root: rel,
        pbxproj: "// Generated Fenix iOS wrapper for it.fenix.onda\n",
        bundleId: "it.fenix.onda",
        buildNumber: "1720000000",
      },
    );
    assert.equal(bad.ok, false);
    assert.match(bad.error || "", /PBXNativeTarget|pbxproj/i);
  });

  it("materializeIos writes App.swift, Info.plist, index.html, shared scheme, real pbxproj", () => {
    const job = sampleJob({ id: "job-ios-proj" });
    const { root } = materializeIos(job, "TEAMID1");
    const pbx = readFileSync(join(root, "Fenix.xcodeproj", "project.pbxproj"), "utf8");
    assert.doesNotMatch(pbx.trim(), /^\/\/[^\n]*$/);
    assert.match(pbx, /isa = PBXNativeTarget/);
    assert.match(pbx, /isa = PBXFileReference/);
    assert.match(pbx, /App\.swift/);
    assert.match(pbx, /Info\.plist/);
    assert.match(pbx, /index\.html/);
    assert.match(pbx, /PRODUCT_BUNDLE_IDENTIFIER = it\.fenix\.onda/);
    assert.match(pbx, /DEVELOPMENT_TEAM = TEAMID1/);
    assert.match(pbx, /CURRENT_PROJECT_VERSION = 1720000000/);
    assert.equal(existsSync(join(root, "Fenix", "App.swift")), true);
    assert.equal(existsSync(join(root, "Fenix", "Info.plist")), true);
    assert.equal(existsSync(join(root, "Fenix", "index.html")), true);
    assert.equal(
      existsSync(join(root, "Fenix.xcodeproj", "xcshareddata", "xcschemes", "Fenix.xcscheme")),
      true,
    );
    const plist = readFileSync(join(root, "Fenix", "Info.plist"), "utf8");
    assert.match(plist, /<key>CFBundleVersion<\/key>\s*<string>1720000000<\/string>/);
    assert.doesNotMatch(plist, /<key>CFBundleVersion<\/key>\s*<string>1<\/string>/);
    const check = validateIosProject({
      root,
      pbxproj: pbx,
      bundleId: "it.fenix.onda",
      buildNumber: "1720000000",
    });
    assert.equal(check.ok, true, check.ok === false ? check.error : "");
  });
});

describe("fase2 Android project is buildable", () => {
  const prevRel = process.env.FENIX_RELEASE_DIR;
  const rel = mkdtempSync(join(tmpdir(), "fenix-fase2-and-"));
  before(() => {
    process.env.FENIX_RELEASE_DIR = rel;
  });
  after(() => {
    if (prevRel === undefined) delete process.env.FENIX_RELEASE_DIR;
    else process.env.FENIX_RELEASE_DIR = prevRel;
    rmSync(rel, { recursive: true, force: true });
  });

  it("rejects a manifest without xmlns:android and a package mismatch", () => {
    const noNs = validateAndroidProject({
      root: rel,
      packageName: "it.fenix.onda",
      versionCode: 1720000000,
      manifest: `<manifest package="it.fenix.onda"><application/></manifest>`,
      appGradle: `android { namespace 'it.fenix.onda' defaultConfig { applicationId 'it.fenix.onda' versionCode 1720000000 } }`,
      mainActivity: `package it.fenix.onda; class MainActivity {}`,
      mainActivityPath: join(rel, "app/src/main/java/it/fenix/onda/MainActivity.java"),
    });
    assert.equal(noNs.ok, false);
    assert.match(noNs.error || "", /xmlns:android/);

    const mismatch = validateAndroidProject({
      root: rel,
      packageName: "it.fenix.onda",
      versionCode: 1720000000,
      manifest: `<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="it.fenix.onda"/>`,
      appGradle: `android { namespace 'it.fenix.app' defaultConfig { applicationId 'it.fenix.app' versionCode 1 } }`,
      mainActivity: `package it.fenix.app; class MainActivity {}`,
      mainActivityPath: join(rel, "app/src/main/java/it/fenix/app/MainActivity.java"),
    });
    assert.equal(mismatch.ok, false);
    assert.match(mismatch.error || "", /namespace|applicationId|package/i);
  });

  it("materializeAndroid writes xmlns, dynamic package path, root Gradle, wrapper, versionCode", () => {
    const job = sampleJob({ id: "job-and-proj", platforms: ["android"] });
    const { root } = materializeAndroid(job);
    const manifest = readFileSync(join(root, "app/src/main/AndroidManifest.xml"), "utf8");
    assert.match(manifest, /xmlns:android="http:\/\/schemas\.android\.com\/apk\/res\/android"/);
    const javaPath = join(root, "app/src/main/java/it/fenix/onda/MainActivity.java");
    assert.equal(existsSync(javaPath), true);
    assert.equal(existsSync(join(root, "app/src/main/java/it/fenix/app/MainActivity.java")), false);
    const java = readFileSync(javaPath, "utf8");
    assert.match(java, /package it\.fenix\.onda;/);
    const appGradle = readFileSync(join(root, "app/build.gradle"), "utf8");
    assert.match(appGradle, /namespace ['"]it\.fenix\.onda['"]/);
    assert.match(appGradle, /applicationId ['"]it\.fenix\.onda['"]/);
    assert.match(appGradle, /versionCode 1720000000/);
    assert.equal(existsSync(join(root, "build.gradle")), true);
    assert.equal(existsSync(join(root, "settings.gradle")), true);
    const settings = readFileSync(join(root, "settings.gradle"), "utf8");
    assert.match(settings, /pluginManagement|google\(\)|mavenCentral/);
    assert.equal(existsSync(join(root, "gradle/wrapper/gradle-wrapper.properties")), true);
    assert.equal(existsSync(join(root, "gradlew")), true);
    const check = validateAndroidProject({
      root,
      packageName: "it.fenix.onda",
      versionCode: 1720000000,
      manifest,
      appGradle,
      mainActivity: java,
      mainActivityPath: javaPath,
    });
    assert.equal(check.ok, true, check.ok === false ? check.error : "");
  });
});

describe("fase2 distributed claim is SQL unique, not a process Map", () => {
  afterEach(() => {
    resetReleaseClaimsForTest();
    setReleaseSqlForTest(null);
    setReleaseBlobsForTest(null);
  });

  it("two independent blob maps can both win — that backend is not used for distributed claims", async () => {
    const a = new Map<string, unknown>();
    const b = new Map<string, unknown>();
    const storeA = {
      async get(key: string) {
        return a.get(key) ?? null;
      },
      async setJSON(key: string, value: unknown) {
        a.set(key, value);
      },
    };
    const storeB = {
      async get(key: string) {
        return b.get(key) ?? null;
      },
      async setJSON(key: string, value: unknown) {
        b.set(key, value);
      },
    };
    setReleaseBlobsForTest(storeA);
    const one = await claimReleaseKey("c".repeat(64), "11111111-1111-4111-8111-111111111111");
    setReleaseBlobsForTest(storeB);
    const two = await claimReleaseKey("c".repeat(64), "22222222-2222-4222-8222-222222222222");
    // Blobs without CAS: both instances believe they won. Postgres must not.
    assert.equal(one.won && two.won, true);
  });

  it("two store instances on one Postgres: one winner, same id, no shared Map", async () => {
    const pg = await createReleaseSqlForTest();
    const storeA = createReleaseStore({ sql: pg.sql, instanceId: "A" });
    const storeB = createReleaseStore({ sql: pg.sql, instanceId: "B" });
    const key = "d".repeat(64);
    const [x, y] = await Promise.all([
      storeA.claimReleaseKey(key, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      storeB.claimReleaseKey(key, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    ]);
    assert.equal(x.id, y.id);
    assert.equal([x, y].filter((r) => r.won).length, 1);
    await pg.close();
  });
});

describe("fase2 Apple upload uses a temp .p8 and exact build identity", () => {
  const prevRel = process.env.FENIX_RELEASE_DIR;
  const rel = mkdtempSync(join(tmpdir(), "fenix-fase2-apple-"));
  afterEach(() => setReleaseFetchForTest(null));
  before(() => {
    process.env.FENIX_RELEASE_DIR = rel;
  });
  after(() => {
    if (prevRel === undefined) delete process.env.FENIX_RELEASE_DIR;
    else process.env.FENIX_RELEASE_DIR = prevRel;
    rmSync(rel, { recursive: true, force: true });
  });

  it("altool is invoked with API_PRIVATE_KEYS_DIR and never logs the pem", async () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const job = sampleJob({ id: "job-ios-p8" });
    const { root } = materializeIos(job, "TEAMID1");
    const ipa = join(root, "export", "Fenix.ipa");
    const track: TrackState = {
      platform: "ios",
      step: "upload",
      status: "run",
      fixture: false,
      uploads: 0,
      provider: {
        ipaPath: ipa,
        appId: "app1",
        archivePath: join(root, "it.fenix.onda.xcarchive"),
      },
    };
    let sawKeysDir = false;
    let loggedPem = false;
    const uploaded = await runIosStep("upload", job, track, persistInto(track), {
      fixture: false,
      creds: { issuerId: "iss-123456789", keyId: "KEYID12345", privateKey: pem },
      teamId: "TEAMID1",
      commands: async (file, args, opts) => {
        const blob = JSON.stringify({ file, args, env: opts?.env || {} });
        if (blob.includes("BEGIN PRIVATE KEY") || blob.includes(pem.slice(0, 40))) loggedPem = true;
        if (opts?.env?.API_PRIVATE_KEYS_DIR) {
          sawKeysDir = true;
          const p8 = join(opts.env.API_PRIVATE_KEYS_DIR, "AuthKey_KEYID12345.p8");
          assert.equal(existsSync(p8), true);
        }
        if (file === "xcrun" && args[0] === "altool") {
          return { ok: true, code: 0, stdout: "UPLOAD_OK", stderr: "" };
        }
        return fixtureCommand(file, args, opts);
      },
    });
    assert.equal(uploaded.ok, true, uploaded.error);
    assert.equal(sawKeysDir, true);
    assert.equal(loggedPem, false);
  });

  it("appleListLatestBuild ignores a newer unrelated build and does not synthesize asc:*", async () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    setReleaseFetchForTest(async (input) => {
      const url = String(input);
      assert.match(url, /filter\[version\]=1720000000|filter%5Bversion%5D=1720000000|filter.*1720000000/);
      return Response.json({
        data: [
          {
            id: "build-other",
            attributes: { version: "999", processingState: "VALID" },
          },
        ],
      });
    });
    const listed = await appleListLatestBuild(
      { issuerId: "iss-123456789", keyId: "KEYID12345", privateKey: pem },
      "app1",
      { versionName: "1.0", build: "1720000000" },
    );
    assert.equal(listed.ok, true);
    assert.equal(listed.id, undefined);

    const job = sampleJob({ id: "job-ios-exact" });
    const track: TrackState = {
      platform: "ios",
      step: "upload",
      status: "run",
      fixture: false,
      uploads: 0,
      provider: {
        appId: "app1",
        inflight: "upload",
        intentId: `${job.id}:ios:upload`,
        ipaPath: join(rel, "missing.ipa"),
      },
    };
    setReleaseFetchForTest(async () =>
      Response.json({
        data: [{ id: "build-other", attributes: { version: "999", processingState: "VALID" } }],
      }),
    );
    const inflight = await runIosStep("upload", job, track, persistInto(track), {
      fixture: false,
      creds: { issuerId: "iss-123456789", keyId: "KEYID12345", privateKey: pem },
    });
    assert.equal(inflight.ok, true);
    assert.equal(inflight.pending, true);
    assert.doesNotMatch(track.provider?.uploadId || "", /^asc:/);
  });
});

describe("fase2 Android jarsigner credentials and Play exact version", () => {
  const prevRel = process.env.FENIX_RELEASE_DIR;
  const rel = mkdtempSync(join(tmpdir(), "fenix-fase2-play-"));
  afterEach(() => setReleaseFetchForTest(null));
  before(() => {
    process.env.FENIX_RELEASE_DIR = rel;
  });
  after(() => {
    if (prevRel === undefined) delete process.env.FENIX_RELEASE_DIR;
    else process.env.FENIX_RELEASE_DIR = prevRel;
    rmSync(rel, { recursive: true, force: true });
  });

  it("rejects jarsigner without keystore/alias/passwords and passes redacted args when present", async () => {
    const job = sampleJob({ id: "job-and-sign", platforms: ["android"] });
    const aab = join(rel, "work", job.id, "android", "app/build/outputs/bundle/release/app-release.aab");
    await fixtureCommand("gradle", ["bundleRelease"], {
      cwd: join(rel, "work", job.id, "android"),
    });
    const track: TrackState = {
      platform: "android",
      step: "sign",
      status: "run",
      fixture: false,
      uploads: 0,
      provider: { aabPath: aab },
    };
    const missing = await runAndroidStep("sign", job, track, persistInto(track), {
      fixture: false,
      serviceJson: "{}",
    });
    assert.equal(missing.ok, false);
    assert.match(missing.error || "", /keystore|alias|password/i);

    let captured: string[] = [];
    const signed = await runAndroidStep("sign", job, track, persistInto(track), {
      fixture: false,
      serviceJson: "{}",
      keystorePath: "/tmp/upload.keystore",
      keyAlias: "upload",
      storePassword: "store-secret-value",
      keyPassword: "key-secret-value",
      commands: async (file, args, opts) => {
        if (file === "jarsigner") captured = args;
        return fixtureCommand(file, args, opts);
      },
    });
    assert.equal(signed.ok, true, signed.error);
    assert.ok(captured.includes("-keystore"));
    assert.ok(captured.includes("/tmp/upload.keystore"));
    assert.ok(captured.includes("upload"));
    const redacted = redactArgs(captured);
    assert.equal(redacted.includes("store-secret-value"), false);
    assert.equal(redacted.includes("key-secret-value"), false);
    assert.ok(redacted.includes("[redacted]"));
  });

  it("playGetInternalTrack opens an edit and never uses /tracks/internal without edits", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const json = JSON.stringify({ client_email: "play@fenix.test", private_key: pem });
    const urls: string[] = [];
    setReleaseFetchForTest(async (input, init) => {
      const url = String(input);
      const method = String(init?.method || "GET").toUpperCase();
      urls.push(`${method} ${url}`);
      if (url.includes("oauth2.googleapis.com/token")) {
        return Response.json({ access_token: "ya29.not-a-real-token-value" });
      }
      if (url.endsWith("/edits") && method === "POST") {
        return Response.json({ id: "edit-track-1" });
      }
      if (url.includes("/edits/edit-track-1/tracks/internal") && method === "GET") {
        return Response.json({
          track: "internal",
          releases: [{ status: "completed", versionCodes: ["1720000000"] }],
        });
      }
      if (url.includes("/edits/edit-track-1") && method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      return new Response("no", { status: 404 });
    });
    const poll = await playGetInternalTrack(json, "it.fenix.onda", "1720000000");
    assert.equal(poll.ok, true, poll.ok ? "" : poll.error);
    assert.equal(poll.state, "completed");
    assert.ok(urls.some((u) => /GET .*\/edits\/edit-track-1\/tracks\/internal/.test(u)));
    assert.equal(
      urls.some((u) => /\/applications\/it\.fenix\.onda\/tracks\/internal/.test(u) && !u.includes("/edits/")),
      false,
    );
  });

  it("Play 404 / no-longer-valid is not success unless the exact versionCode is on internal", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const json = JSON.stringify({ client_email: "play@fenix.test", private_key: pem });
    setReleaseFetchForTest(async (input, init) => {
      const url = String(input);
      const method = String(init?.method || "GET").toUpperCase();
      if (url.includes("oauth2.googleapis.com/token")) {
        return Response.json({ access_token: "ya29.not-a-real-token-value" });
      }
      if (url.endsWith("/edits") && method === "POST") {
        return Response.json({ id: "edit-x" });
      }
      if (url.includes("/tracks/internal") && method === "PUT") {
        return new Response("no longer valid", { status: 404 });
      }
      if (url.includes("/edits/edit-x/tracks/internal") && method === "GET") {
        return Response.json({ track: "internal", releases: [{ status: "completed", versionCodes: ["9"] }] });
      }
      return Response.json({});
    });
    const aab = join(rel, "work", "job-play-exact", "android", "app/build/outputs/bundle/release/app-release.aab");
    await fixtureCommand("gradle", ["bundleRelease"], {
      cwd: join(rel, "work", "job-play-exact", "android"),
    });
    const job = sampleJob({ id: "job-play-exact", platforms: ["android"] });
    const track: TrackState = {
      platform: "android",
      step: "upload",
      status: "run",
      fixture: false,
      uploads: 0,
      provider: {
        aabPath: aab,
        signedAabPath: aab,
        editId: "edit-x",
        versionCode: "1720000000",
        inflight: "play-commit",
      },
    };
    const first = await runAndroidStep("upload", job, track, persistInto(track), {
      fixture: false,
      serviceJson: json,
      keystorePath: "/tmp/upload.keystore",
    });
    assert.equal(first.ok, false);
    assert.match(first.error || "", /versionCode|internal|esatt/i);
  });
});

describe("fase2 web keeps the Netlify ssl_url and native work is dispatched", () => {
  afterEach(() => {
    setReleaseFetchForTest(null);
    delete process.env.NETLIFY_AUTH_TOKEN;
    delete process.env.NETLIFY;
    delete process.env.FENIX_NATIVE_DISPATCH;
    delete process.env.FENIX_RELEASE_WORKER;
  });

  it("upload artifact is the site ssl_url, not only /sito/{id}", async () => {
    process.env.NETLIFY_AUTH_TOKEN = "nfp_testtokenvaluexx";
    setReleaseFetchForTest(async (input, init) => {
      const url = String(input);
      const method = String(init?.method || "GET").toUpperCase();
      if (url.includes("/api/v1/sites/") && url.includes("/deploys") && method === "POST") {
        return Response.json({
          id: "dep-live",
          state: "ready",
          ssl_url: "https://onda-live.netlify.app",
          url: "http://onda-live.netlify.app",
        });
      }
      if (url.includes("/api/v1/sites") && method === "POST") {
        return Response.json({
          id: "site-live",
          name: "fenix-onda",
          ssl_url: "https://onda-live.netlify.app",
          url: "http://onda-live.netlify.app",
        });
      }
      if (url.includes("/api/v1/sites?") || url.endsWith("/api/v1/sites")) {
        return Response.json([]);
      }
      if (url.includes("/api/v1/deploys/dep-live")) {
        return Response.json({
          id: "dep-live",
          state: "ready",
          ssl_url: "https://onda-live.netlify.app",
        });
      }
      return new Response("no", { status: 404 });
    });
    const prevPub = process.env.FENIX_PUBLISHED_DIR;
    const prevRel = process.env.FENIX_RELEASE_DIR;
    process.env.FENIX_PUBLISHED_DIR = mkdtempSync(join(tmpdir(), "fenix-fase2-pub-"));
    process.env.FENIX_RELEASE_DIR = mkdtempSync(join(tmpdir(), "fenix-fase2-wrel-"));
    try {
      const job = sampleJob({ id: "job-web-url", platforms: ["web"], projectId: "onda-rel-ssl" });
      const track: TrackState = {
        platform: "web",
        step: "upload",
        status: "run",
        fixture: false,
        uploads: 0,
      };
      const first = await runWebStep("upload", job, track, persistInto(track), {
        ownerId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      });
      assert.equal(first.ok, true, first.error);
      assert.equal(first.artifact, "https://onda-live.netlify.app");
      assert.equal(track.provider?.liveUrl, "https://onda-live.netlify.app");
    } finally {
      if (prevPub === undefined) delete process.env.FENIX_PUBLISHED_DIR;
      else process.env.FENIX_PUBLISHED_DIR = prevPub;
      if (prevRel === undefined) delete process.env.FENIX_RELEASE_DIR;
      else process.env.FENIX_RELEASE_DIR = prevRel;
    }
  });

  it("Netlify request does not run xcodebuild: native steps dispatch instead", () => {
    process.env.NETLIFY = "1";
    process.env.FENIX_NATIVE_DISPATCH = "1";
    assert.equal(shouldDispatchNative("ios", "build", false), true);
    assert.equal(shouldDispatchNative("android", "upload", false), true);
    assert.equal(shouldDispatchNative("web", "upload", false), false);
    assert.equal(shouldDispatchNative("ios", "build", true), false);
    process.env.FENIX_RELEASE_WORKER = "ios";
    assert.equal(shouldDispatchNative("ios", "build", false), false);
  });
});
