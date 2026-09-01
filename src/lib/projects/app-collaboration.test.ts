import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import {
  appAccessCookieName,
  handleAppCollaborationRequest,
  resolveAppAccess,
} from "./app-collaboration.ts";
import { OWNER_HEADER } from "./publish-owner.ts";
import { hashOwner } from "./published-store.ts";
import type { StoredSnapshot } from "./published.ts";

const here = dirname(fileURLToPath(import.meta.url));
const siteId = "site-collab-1234";
const ownerA = "a".repeat(32);
const ownerB = "b".repeat(32);
const token = "c".repeat(64);
const inviteId = "invite-viewer-0001";
const now = 1_800_000_000_000;
let pg: PGlite;
let sql: Sql;

before(async () => {
  pg = new PGlite();
  await pg.waitReady;
  await pg.exec(readFileSync(join(here, "../../../migrations/0005_app_collaboration.sql"), "utf8"));
  const query = async <T = Record<string, unknown>>(text: string, params: unknown[] = []) => {
    const result = await pg.query<T>(text, params);
    return result.rows;
  };
  const tagged = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return query<T>(text, values);
  }) as Sql;
  tagged.query = query;
  sql = tagged;
});

after(async () => {
  await pg.close();
});

const site: StoredSnapshot = {
  id: siteId,
  name: "Argilla condivisa",
  tagline: "",
  kind: "app",
  summary: "",
  palette: {
    bg: "#ffffff",
    surface: "#f7f4ee",
    fg: "#1c1712",
    muted: "#6e5648",
    accent: "#b85c38",
  },
  html: "<!doctype html><html><body>" + "x".repeat(100) + "</body></html>",
  version: 1,
  hash: "deadbeefdeadbeef",
  publishedAt: now,
  ownerHash: hashOwner(ownerA),
};

function request(
  method: "GET" | "POST",
  body?: unknown,
  options: { owner?: string; cookie?: string; origin?: string } = {},
): Request {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (options.owner) headers.set(OWNER_HEADER, options.owner);
  if (options.cookie) headers.set("cookie", options.cookie);
  headers.set("origin", options.origin ?? "https://fenix.test");
  headers.set("sec-fetch-site", "same-origin");
  return new Request(`https://fenix.test/api/app-access/${siteId}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("published app collaboration capabilities", () => {
  const deps = {
    get sql() {
      return sql;
    },
    durable: true,
    now: () => now,
    token: () => token,
    id: () => inviteId,
    readSite: async (id: string) => (id === siteId ? site : null),
  };

  it("creates an owner-bound invite, returns the raw token once and lists only metadata", async () => {
    const denied = await handleAppCollaborationRequest(
      request("POST", { op: "create", role: "viewer", label: "Lettura" }, { owner: ownerB }),
      siteId,
      deps,
    );
    assert.equal(denied.status, 403);

    const created = await handleAppCollaborationRequest(
      request("POST", { op: "create", role: "viewer", label: "Lettura" }, { owner: ownerA }),
      siteId,
      deps,
    );
    assert.equal(created.status, 201);
    const raw = await created.text();
    assert.match(raw, new RegExp(token));
    const payload = JSON.parse(raw) as { invite: { id: string; role: string }; token: string };
    assert.equal(payload.invite.id, inviteId);
    assert.equal(payload.invite.role, "viewer");

    const listed = await handleAppCollaborationRequest(
      request("GET", undefined, { owner: ownerA }),
      siteId,
      deps,
    );
    assert.equal(listed.status, 200);
    const listRaw = await listed.text();
    assert.doesNotMatch(listRaw, new RegExp(token));
    assert.deepEqual(
      (JSON.parse(listRaw) as { invites: { id: string }[] }).invites.map((x) => x.id),
      [inviteId],
    );
  });

  it("exchanges only same-origin capabilities into a scoped HttpOnly cookie", async () => {
    const cross = await handleAppCollaborationRequest(
      request("POST", { op: "exchange", token }, { origin: "https://evil.test" }),
      siteId,
      deps,
    );
    assert.equal(cross.status, 403);

    const exchanged = await handleAppCollaborationRequest(
      request("POST", { op: "exchange", token }),
      siteId,
      deps,
    );
    assert.equal(exchanged.status, 200);
    assert.deepEqual(await exchanged.json(), {
      ok: true,
      role: "viewer",
      shared: true,
      expiresIn: 2_592_000_000,
    });
    const setCookie = exchanged.headers.get("set-cookie") || "";
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    assert.match(setCookie, new RegExp(`Path=/api/app-data/${siteId}`));
    const pair = `${appAccessCookieName(siteId)}=${token}`;
    assert.deepEqual(
      await resolveAppAccess(sql, request("POST", {}, { cookie: pair }), siteId, now),
      { state: "active", role: "viewer", inviteId, cookieName: appAccessCookieName(siteId) },
    );
    assert.deepEqual(
      await resolveAppAccess(
        sql,
        request("POST", {}, { cookie: `${appAccessCookieName(siteId)}=malformed` }),
        siteId,
        now,
      ),
      { state: "invalid", cookieName: appAccessCookieName(siteId) },
      "a present but malformed share cookie must fail closed instead of becoming private",
    );
  });

  it("revocation is immediate and the raw capability is never stored", async () => {
    const revoked = await handleAppCollaborationRequest(
      request("POST", { op: "revoke", id: inviteId }, { owner: ownerA }),
      siteId,
      deps,
    );
    assert.equal(revoked.status, 200);
    const pair = `${appAccessCookieName(siteId)}=${token}`;
    assert.deepEqual(
      await resolveAppAccess(sql, request("POST", {}, { cookie: pair }), siteId, now),
      { state: "invalid", cookieName: appAccessCookieName(siteId) },
    );
    const rows = await sql.query<{ token_hash: string }>(
      "select token_hash from fenix_app_access where id=$1",
      [inviteId],
    );
    assert.equal(rows.length, 1);
    assert.match(rows[0]!.token_hash, /^[a-f0-9]{64}$/);
    assert.notEqual(rows[0]!.token_hash, token);
  });
});
