import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ensureFenixAdapter } from "./fenix-adapter.ts";
import {
  isPublishedId,
  parsePublishInput,
  snapshotHash,
} from "./published.ts";
import { readPublished, writePublished } from "./published-store.ts";

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
    });
    assert.equal("error" in first, false);
    if ("error" in first) return;
    assert.equal(first.version, 1);
    assert.equal(first.id, id);
    const again = await writePublished(id, {
      name: "Onda",
      kind: "site",
      palette: PALETTE,
      html: ADAPTED,
    });
    assert.equal("error" in again, false);
    if ("error" in again) return;
    assert.equal(again.version, 1);
    assert.equal(again.hash, first.hash);
    const bumped = await writePublished(id, {
      name: "Onda",
      kind: "site",
      palette: PALETTE,
      html: ADAPTED.replace("Onda", "Onda Live"),
    });
    assert.equal("error" in bumped, false);
    if ("error" in bumped) return;
    assert.equal(bumped.version, 2);
    const loaded = await readPublished(id);
    assert.equal(loaded?.version, 2);
    assert.match(loaded?.html || "", /Onda Live/);
  });

  it("refuses HTML that is not publishable", async () => {
    const result = await writePublished("onda-site-02", {
      name: "Vuoto",
      kind: "site",
      palette: PALETTE,
      html: "<html><body>ciao</body></html>",
    });
    assert.equal("error" in result, true);
  });
});
