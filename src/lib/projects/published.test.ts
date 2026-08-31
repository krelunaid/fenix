import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ensureFenixAdapter } from "./fenix-adapter.ts";
import { scrubCraftMedia } from "../ai/hero-image.ts";
import { OWNER_HEADER } from "./publish-owner.ts";
import {
  isPublishedId,
  parsePublishInput,
  snapshotHash,
} from "./published.ts";
import { hashOwner, publicSnapshot, readPublished, writePublished } from "./published-store.ts";
import { handleSiteRequest } from "./sites-http.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SITE = readFileSync(join(here, "fixtures/music-site-no-fenix.html"), "utf8");
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

function access(ownerId: string, ifMatch?: string) {
  return { ownerId, ifMatch };
}

describe("published snapshot helpers", () => {
  it("rejects short ids and accepts uuid-like keys", () => {
    assert.equal(isPublishedId("p1"), false);
    assert.equal(isPublishedId("8b04fd98-106c-46f5-ac9a-1e929028c476"), true);
    assert.equal(isPublishedId("../etc/passwd"), false);
  });

  it("keeps hash stable for the same html and changes when content changes", () => {
    const a = snapshotHash("<html>a</html>", "site", "Onda");
    const b = snapshotHash("<html>a</html>", "site", "Onda");
    const c = snapshotHash("<html>b</html>", "site", "Onda");
    assert.equal(a, b);
    assert.notEqual(a, c);
  });

  it("parsePublishInput requires html, kind and palette", () => {
    const bad = parsePublishInput({ html: "<p>x</p>" });
    assert.equal("error" in bad, true);
    const ok = parsePublishInput({
      name: "Onda",
      kind: "site",
      palette: PALETTE,
      html: ADAPTED,
    });
    assert.equal("error" in ok, false);
  });

  it("hashes owner ids without storing the raw capability", () => {
    const h = hashOwner(OWNER_A);
    assert.equal(h, hashOwner(OWNER_A));
    assert.notEqual(h, hashOwner(OWNER_B));
    assert.equal(h.includes(OWNER_A), false);
    assert.equal(h.length, 64);
  });
});

describe("published store", () => {
  const prev = process.env.FENIX_PUBLISHED_DIR;
  const dir = mkdtempSync(join(tmpdir(), "fenix-pub-"));

  before(() => {
    process.env.FENIX_PUBLISHED_DIR = dir;
    delete process.env.NETLIFY;
    delete process.env.NETLIFY_BLOBS_CONTEXT;
  });
  after(() => {
    if (prev === undefined) delete process.env.FENIX_PUBLISHED_DIR;
    else process.env.FENIX_PUBLISHED_DIR = prev;
  });

  it("writes a versioned snapshot and returns the same version on identical html", async () => {
    const id = "onda-site-01";
    const first = await writePublished(id, {
      name: "Onda",
      kind: "site",
      palette: PALETTE,
      html: ADAPTED,
    }, access(OWNER_A));
    assert.equal("error" in first, false);
    if ("error" in first) return;
    assert.equal(first.version, 1);
    assert.equal(first.id, id);
    assert.equal("ownerHash" in first, false);
    const again = await writePublished(id, {
      name: "Onda",
      kind: "site",
      palette: PALETTE,
      html: ADAPTED,
    }, access(OWNER_A));
    assert.equal("error" in again, false);
    if ("error" in again) return;
    assert.equal(again.version, 1);
    assert.equal(again.hash, first.hash);
    const bumped = await writePublished(id, {
      name: "Onda",
      kind: "site",
      palette: PALETTE,
      html: ADAPTED.replace("Onda", "Onda Live"),
    }, access(OWNER_A, `"${again.version}"`));
    assert.equal("error" in bumped, false);
    if ("error" in bumped) return;
    assert.equal(bumped.version, 2);
    const loaded = await readPublished(id);
    assert.equal(loaded?.version, 2);
    assert.match(loaded?.html || "", /Onda Live/);
    assert.equal(loaded?.ownerHash, hashOwner(OWNER_A));
    const pub = publicSnapshot(loaded!);
    assert.equal("ownerHash" in pub, false);
  });

  it("public snapshot strips page-screenshot heroes, dead piatto photos, and ownerHash", () => {
    const html = `<html><body><img class="fk-hero" src="data:image/jpeg;base64,AAA" alt=""/><img src="https://images.unsplash.com/photo-1595878715977-2e8f8df18ea7?w=800" alt="Piatto da portata"/></body></html>`;
    const pub = publicSnapshot({
      id: "onda-site-09",
      name: "Bottega",
      tagline: "",
      kind: "site",
      summary: "",
      palette: PALETTE,
      html,
      version: 1,
      hash: "abc",
      publishedAt: 1,
      ownerHash: "deadbeef".repeat(8),
    });
    assert.equal("ownerHash" in pub, false);
    assert.doesNotMatch(pub.html, /data:image\/jpeg/);
    assert.doesNotMatch(pub.html, /photo-1595878715977/);
    assert.match(pub.html, /fk-hero-craft/);
    assert.match(pub.html, /\/craft-hero\.jpg/);
    assert.doesNotMatch(pub.html, /photo-1610701596007/);
    assert.match(pub.html, /Piatto da portata/);
  });

  it("legacy ownerless snapshot cannot be claimed by replaying the same body", async () => {
    const id = "onda-site-legacy";
    const html = scrubCraftMedia(ADAPTED);
    const snap = {
      id,
      name: "Onda",
      tagline: "",
      kind: "site" as const,
      summary: "",
      palette: PALETTE,
      html,
      version: 1,
      hash: snapshotHash(html, "site", "Onda"),
      publishedAt: 1,
    };
    const path = join(dir, `${id}.json`);
    writeFileSync(path, JSON.stringify(snap));
    const before = readFileSync(path);
    const claim = await writePublished(
      id,
      {
        name: "Onda",
        kind: "site",
        palette: PALETTE,
        html: ADAPTED,
      },
      access(OWNER_B),
    );
    assert.equal("error" in claim, true);
    if ("error" in claim) {
      assert.equal(claim.status, 409);
      assert.match(claim.error, /immutabile/);
    }
    assert.deepEqual(readFileSync(path), before);
    const loaded = await readPublished(id);
    assert.equal(loaded?.ownerHash, undefined);
    assert.equal(loaded?.html, html);
    assert.equal(loaded?.hash, snap.hash);
  });

  it("refuses HTML that is not publishable", async () => {
    const result = await writePublished("onda-site-02", {
      name: "Vuoto",
      kind: "site",
      palette: PALETTE,
      html: "<html><body>ciao</body></html>",
    }, access(OWNER_A));
    assert.equal("error" in result, true);
  });

  it("rejects missing owner, other owner, and stale If-Match", async () => {
    const id = "onda-site-03";
    const missing = await writePublished(id, {
      name: "Onda",
      kind: "site",
      palette: PALETTE,
      html: ADAPTED,
    });
    assert.equal("error" in missing, true);
    if ("error" in missing) assert.equal(missing.status, 401);

    const created = await writePublished(id, {
      name: "Onda",
      kind: "site",
      palette: PALETTE,
      html: ADAPTED,
    }, access(OWNER_A));
    assert.equal("error" in created, false);
    if ("error" in created) return;

    const other = await writePublished(id, {
      name: "Onda",
      kind: "site",
      palette: PALETTE,
      html: ADAPTED.replace("Onda", "Hijack"),
    }, access(OWNER_B, `"${created.version}"`));
    assert.equal("error" in other, true);
    if ("error" in other) assert.equal(other.status, 403);

    const stale = await writePublished(id, {
      name: "Onda",
      kind: "site",
      palette: PALETTE,
      html: ADAPTED.replace("Onda", "Onda Due"),
    }, access(OWNER_A, `"0"`));
    assert.equal("error" in stale, true);
    if ("error" in stale) assert.equal(stale.status, 409);

    const noMatch = await writePublished(id, {
      name: "Onda",
      kind: "site",
      palette: PALETTE,
      html: ADAPTED.replace("Onda", "Onda Tre"),
    }, access(OWNER_A));
    assert.equal("error" in noMatch, true);
    if ("error" in noMatch) assert.equal(noMatch.status, 409);
  });
});

describe("sites HTTP handler", () => {
  const prev = process.env.FENIX_PUBLISHED_DIR;
  const dir = mkdtempSync(join(tmpdir(), "fenix-http-"));

  before(() => {
    process.env.FENIX_PUBLISHED_DIR = dir;
    delete process.env.NETLIFY;
    delete process.env.NETLIFY_BLOBS_CONTEXT;
  });
  after(() => {
    if (prev === undefined) delete process.env.FENIX_PUBLISHED_DIR;
    else process.env.FENIX_PUBLISHED_DIR = prev;
  });

  const payload = {
    name: "Onda",
    kind: "site",
    palette: PALETTE,
    html: ADAPTED,
  };

  it("anonymous PUT 401, owner create, other 403, GET anon 200, lost update 409", async () => {
    const id = "onda-http-01";
    const anon = await handleSiteRequest(
      new Request(`http://local/api/sites/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
      id,
    );
    assert.equal(anon.status, 401);

    const created = await handleSiteRequest(
      new Request(`http://local/api/sites/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json", [OWNER_HEADER]: OWNER_A },
        body: JSON.stringify(payload),
      }),
      id,
    );
    assert.equal(created.status, 200);
    const snap = (await created.json()) as { version: number; ownerHash?: string };
    assert.equal(snap.version, 1);
    assert.equal(snap.ownerHash, undefined);

    const get = await handleSiteRequest(new Request(`http://local/api/sites/${id}`), id);
    assert.equal(get.status, 200);
    const publicJson = (await get.json()) as { html: string; ownerHash?: string };
    assert.equal(publicJson.ownerHash, undefined);
    assert.match(publicJson.html, /Onda/);

    const other = await handleSiteRequest(
      new Request(`http://local/api/sites/${id}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          [OWNER_HEADER]: OWNER_B,
          "if-match": `"1"`,
        },
        body: JSON.stringify({ ...payload, html: ADAPTED.replace("Onda", "Hijack") }),
      }),
      id,
    );
    assert.equal(other.status, 403);

    const lost = await handleSiteRequest(
      new Request(`http://local/api/sites/${id}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          [OWNER_HEADER]: OWNER_A,
          "if-match": `"9"`,
        },
        body: JSON.stringify({ ...payload, html: ADAPTED.replace("Onda", "Onda X") }),
      }),
      id,
    );
    assert.equal(lost.status, 409);

    const ok = await handleSiteRequest(
      new Request(`http://local/api/sites/${id}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          [OWNER_HEADER]: OWNER_A,
          "if-match": `"1"`,
        },
        body: JSON.stringify({ ...payload, html: ADAPTED.replace("Onda", "Onda Live") }),
      }),
      id,
    );
    assert.equal(ok.status, 200);
    const updated = (await ok.json()) as { version: number };
    assert.equal(updated.version, 2);

    const viaCustom = await handleSiteRequest(
      new Request(`http://local/api/sites/${id}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          [OWNER_HEADER]: OWNER_A,
          "x-fenix-if-match": `"2"`,
        },
        body: JSON.stringify({ ...payload, html: ADAPTED.replace("Onda", "Onda Netlify") }),
      }),
      id,
    );
    assert.equal(viaCustom.status, 200);
    const custom = (await viaCustom.json()) as { version: number; html?: string };
    assert.equal(custom.version, 3);
    assert.match(String(custom.html || ""), /Onda Netlify/);
  });
});
