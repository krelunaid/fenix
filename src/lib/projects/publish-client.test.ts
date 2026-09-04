import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  getOwnerCapability,
  isLegacyImmutableError,
  publishSnapshot,
  readPublishedId,
  rememberPublishedId,
  resolvePublishedId,
} from "./publish-client.ts";
import {
  OWNER_HEADER,
  OWNER_STORAGE_KEY,
  PUBLISHED_MAP_KEY,
} from "./publish-owner.ts";

const OWNER_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const LEGACY_ID = "legacy-bottega-terra-01";
const PALETTE = {
  bg: "#120c1c",
  surface: "#1c1528",
  fg: "#f4efe8",
  muted: "#9b93c2",
  accent: "#e85d4c",
  line: "#3a3048",
};
const HTML_V1 = `<html><body><h1>Bottega Terra</h1><p>${"x".repeat(80)}</p></body></html>`;
const HTML_V2 = `<html><body><h1>Bottega Terra Live</h1><p>${"y".repeat(80)}</p></body></html>`;

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(String(key), String(value));
    },
  } as Storage;
}

type PutCall = { id: string; owner: string | null; ifMatch: string | null; html: string };

function installFetch(sites: Map<string, { version: number; html: string; owner: string | null }>) {
  const puts: PutCall[] = [];
  const gets: string[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const parsed = new URL(url, "http://local");
    const id = decodeURIComponent(parsed.pathname.split("/api/sites/").pop() || "");
    const method = String(init?.method || "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    const owner = headers.get(OWNER_HEADER);
    if (method === "GET") {
      gets.push(id);
      const snap = sites.get(id);
      if (!snap) {
        return parsed.searchParams.get("optional") === "1"
          ? new Response(null, { status: 204 })
          : new Response("missing", { status: 404 });
      }
      return Response.json({
        id,
        name: "Bottega Terra",
        html: snap.html,
        version: snap.version,
        kind: "site",
      });
    }
    if (method === "PUT") {
      const body = JSON.parse(String(init?.body || "{}")) as { html?: string; name?: string };
      const html = String(body.html || "");
      puts.push({ id, owner, ifMatch: headers.get("If-Match") || headers.get("x-fenix-if-match"), html });
      if (!owner) return Response.json({ error: "Identità assente." }, { status: 401 });
      const existing = sites.get(id);
      if (existing && !existing.owner) {
        return Response.json(
          { error: "Sito pubblico senza titolare: immutabile." },
          { status: 409 },
        );
      }
      if (existing && existing.owner !== owner) {
        return Response.json({ error: "Non sei il titolare di questo sito." }, { status: 403 });
      }
      if (existing && existing.html === html) {
        return Response.json({
          id,
          name: body.name || "Bottega Terra",
          html: existing.html,
          version: existing.version,
          kind: "site",
        });
      }
      if (existing) {
        if (headers.get("If-Match") !== `"${existing.version}"`) {
          return Response.json({ error: "Versione non attuale." }, { status: 409 });
        }
        existing.version += 1;
        existing.html = html;
        return Response.json({
          id,
          name: body.name || "Bottega Terra",
          html,
          version: existing.version,
          kind: "site",
        });
      }
      sites.set(id, { version: 1, html, owner });
      return Response.json({
        id,
        name: body.name || "Bottega Terra",
        html,
        version: 1,
        kind: "site",
      });
    }
    return new Response("no", { status: 405 });
  }) as typeof fetch;
  return { puts, gets, restore: () => { globalThis.fetch = orig; } };
}

const input = (html: string) => ({
  id: LEGACY_ID,
  name: "Bottega Terra",
  kind: "site" as const,
  palette: PALETTE,
  html,
});

describe("legacy publish id mapping", () => {
  let restoreFetch: () => void = () => {};

  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: memoryStorage(),
      configurable: true,
    });
    localStorage.setItem(OWNER_STORAGE_KEY, OWNER_A);
  });

  afterEach(() => {
    restoreFetch();
  });

  it("maps originalProjectId to publishedId only after a successful create", () => {
    assert.equal(readPublishedId(LEGACY_ID), null);
    rememberPublishedId(LEGACY_ID, LEGACY_ID);
    assert.equal(readPublishedId(LEGACY_ID), null);
    rememberPublishedId("short", "also-short");
    assert.equal(readPublishedId("short"), null);
    const created = "c1d2e3f4-1111-4111-8111-aaaaaaaaaaaa";
    rememberPublishedId(LEGACY_ID, created);
    assert.equal(readPublishedId(LEGACY_ID), created);
    rememberPublishedId(LEGACY_ID, "dddddddd-2222-4222-8222-bbbbbbbbbbbb");
    assert.equal(readPublishedId(LEGACY_ID), created);
    assert.match(localStorage.getItem(PUBLISHED_MAP_KEY) || "", /legacy-bottega-terra-01/);
  });

  it("first legacy publish creates one new id; remount reuses it and bumps version", async () => {
    const sites = new Map<string, { version: number; html: string; owner: string | null }>();
    sites.set(LEGACY_ID, { version: 1, html: HTML_V1, owner: null });
    const mock = installFetch(sites);
    restoreFetch = mock.restore;

    const first = await publishSnapshot(input(HTML_V1));
    assert.notEqual(first.id, LEGACY_ID);
    assert.equal(first.version, 1);
    assert.equal(readPublishedId(LEGACY_ID), first.id);
    const createdPuts = mock.puts.filter((p) => p.id !== LEGACY_ID);
    assert.equal(createdPuts.length, 1);
    assert.equal(createdPuts[0]?.id, first.id);
    assert.equal(createdPuts[0]?.ifMatch, null);
    assert.equal(getOwnerCapability(), OWNER_A);

    mock.puts.length = 0;
    const again = await publishSnapshot(input(HTML_V1));
    assert.equal(again.id, first.id);
    assert.equal(again.version, 1);
    assert.equal(readPublishedId(LEGACY_ID), first.id);
    assert.equal(mock.puts.some((p) => p.id === LEGACY_ID), false);
    assert.equal(new Set(mock.puts.map((p) => p.id)).size, 1);
    assert.equal(mock.puts[0]?.id, first.id);
    assert.equal(mock.puts[0]?.ifMatch, `"1"`);

    mock.puts.length = 0;
    const bumped = await publishSnapshot(input(HTML_V2));
    assert.equal(bumped.id, first.id);
    assert.equal(bumped.version, 2);
    assert.equal(sites.get(first.id)?.html.includes("Live"), true);
    assert.equal(mock.puts.some((p) => p.id === LEGACY_ID), false);
  });

  it("failed create does not persist a mapping and does not mint a second id on 403", async () => {
    const sites = new Map<string, { version: number; html: string; owner: string | null }>();
    sites.set(LEGACY_ID, { version: 1, html: HTML_V1, owner: null });
    const mock = installFetch(sites);
    restoreFetch = mock.restore;

    const origFetch = globalThis.fetch;
    let createAttempts = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const id = decodeURIComponent(url.split("/api/sites/").pop() || "");
      const method = String(init?.method || "GET").toUpperCase();
      if (method === "PUT" && id !== LEGACY_ID) {
        createAttempts += 1;
        return Response.json({ error: "Archivio pubblicazione non disponibile." }, { status: 503 });
      }
      return origFetch(input, init);
    }) as typeof fetch;

    await assert.rejects(() => publishSnapshot(input(HTML_V1)), /Archivio|rifiutata/);
    assert.equal(readPublishedId(LEGACY_ID), null);
    assert.equal(createAttempts, 1);

    globalThis.fetch = origFetch;
    const created = await publishSnapshot(input(HTML_V1));
    assert.equal(readPublishedId(LEGACY_ID), created.id);

    localStorage.setItem(OWNER_STORAGE_KEY, OWNER_B);
    mock.puts.length = 0;
    await assert.rejects(() => publishSnapshot(input(HTML_V2)), /titolare/);
    assert.equal(readPublishedId(LEGACY_ID), created.id);
    assert.equal(mock.puts.some((p) => p.id === created.id), true);
    assert.equal(mock.puts.filter((p) => p.id !== LEGACY_ID && p.id !== created.id).length, 0);
  });

  it("owned first publish keeps the original id and writes no map", async () => {
    const sites = new Map<string, { version: number; html: string; owner: string | null }>();
    const mock = installFetch(sites);
    restoreFetch = mock.restore;
    const id = "owned-site-ok-01";
    const snap = await publishSnapshot({
      id,
      name: "Onda",
      kind: "site",
      palette: PALETTE,
      html: HTML_V1,
    });
    assert.equal(snap.id, id);
    assert.equal(readPublishedId(id), null);
    assert.equal(localStorage.getItem(PUBLISHED_MAP_KEY), null);
  });

  it("detects the immutable legacy error", () => {
    assert.equal(isLegacyImmutableError("Sito pubblico senza titolare: immutabile."), true);
    assert.equal(isLegacyImmutableError("Versione non attuale."), false);
  });

  it("resolvePublishedId follows mapping, falls back to original, never PUTs, never invents", async () => {
    const published = "c1d2e3f4-1111-4111-8111-aaaaaaaaaaaa";
    const sites = new Map<string, { version: number; html: string; owner: string | null }>();
    sites.set(published, { version: 1, html: HTML_V1, owner: OWNER_A });
    const mock = installFetch(sites);
    restoreFetch = mock.restore;

    rememberPublishedId(LEGACY_ID, published);
    assert.equal(await resolvePublishedId(LEGACY_ID), published);
    assert.equal(mock.puts.length, 0);
    assert.deepEqual(mock.gets, [published]);

    mock.gets.length = 0;
    assert.equal(await resolvePublishedId(LEGACY_ID, published), published);
    assert.equal(readPublishedId(LEGACY_ID), published);
    assert.equal(mock.puts.length, 0);
    assert.deepEqual(mock.gets, [published]);

    localStorage.removeItem(PUBLISHED_MAP_KEY);
    sites.delete(published);
    sites.set(LEGACY_ID, { version: 1, html: HTML_V1, owner: OWNER_A });
    mock.gets.length = 0;
    assert.equal(await resolvePublishedId(LEGACY_ID, published), LEGACY_ID);
    assert.equal(mock.puts.length, 0);
    assert.deepEqual(mock.gets, [published, LEGACY_ID]);
  });

  it("stale mapped 404 falls back to a valid persisted id and does not PUT", async () => {
    const stale = "dddddddd-2222-4222-8222-bbbbbbbbbbbb";
    const persisted = "c1d2e3f4-1111-4111-8111-aaaaaaaaaaaa";
    const sites = new Map<string, { version: number; html: string; owner: string | null }>();
    sites.set(persisted, { version: 1, html: HTML_V1, owner: OWNER_A });
    const mock = installFetch(sites);
    restoreFetch = mock.restore;

    rememberPublishedId(LEGACY_ID, stale);
    assert.equal(readPublishedId(LEGACY_ID), stale);
    assert.equal(await resolvePublishedId(LEGACY_ID, persisted), persisted);
    assert.equal(readPublishedId(LEGACY_ID), persisted);
    assert.equal(mock.puts.length, 0);
    assert.deepEqual(mock.gets, [stale, persisted]);

    mock.gets.length = 0;
    assert.equal(await resolvePublishedId(LEGACY_ID, persisted), persisted);
    assert.equal(readPublishedId(LEGACY_ID), persisted);
    assert.equal(mock.puts.length, 0);
    assert.deepEqual(mock.gets, [persisted]);
  });

  it("all missing candidates hide the public id, stay idempotent, never PUT", async () => {
    const stale = "dddddddd-2222-4222-8222-bbbbbbbbbbbb";
    const persisted = "c1d2e3f4-1111-4111-8111-aaaaaaaaaaaa";
    const sites = new Map<string, { version: number; html: string; owner: string | null }>();
    const mock = installFetch(sites);
    restoreFetch = mock.restore;

    rememberPublishedId(LEGACY_ID, stale);
    assert.equal(await resolvePublishedId(LEGACY_ID, persisted), null);
    assert.equal(readPublishedId(LEGACY_ID), stale);
    assert.equal(mock.puts.length, 0);
    assert.deepEqual(mock.gets, [stale, persisted, LEGACY_ID]);

    mock.gets.length = 0;
    assert.equal(await resolvePublishedId(LEGACY_ID, persisted), null);
    assert.equal(mock.puts.length, 0);
    assert.deepEqual(mock.gets, [stale, persisted, LEGACY_ID]);
  });
});
