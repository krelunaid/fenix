import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  TAB_IDS,
  applyScreenPatch,
  hasScreenTarget,
  noteAbsent,
  resolvePatchTarget,
  shouldPolishTab,
} from "../../../workers/visual/screen-patch.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const INVALID = readFileSync(join(here, "fixtures/vesti-invalid-collection.html"), "utf8");
const VALID = readFileSync(join(here, "fixtures/vesti.html"), "utf8");
const PRODUCTION = readFileSync(join(here, "fixtures/vesti-production.html"), "utf8");
const WORKER = readFileSync(join(here, "../../../workers/visual/server.mjs"), "utf8");

describe("visual worker screen patches", () => {
  it("preserves replacement metacharacters literally and leaves other views untouched", () => {
    const original = '<header>Keep</header><template id="t-home"><p>Old</p></template><template id="t-list"><p>Saved</p></template><script>window.keep=true</script>';
    for (const token of ["$&", "$1", "$2", "$3", "$'", "$`", "$$", "$100"]) {
      const inner = `<p>Literal ${token}</p>`;
      const expected = `<header>Keep</header><template id="t-home">${inner}</template><template id="t-list"><p>Saved</p></template><script>window.keep=true</script>`;
      const patched = applyScreenPatch(original, "home", inner);
      assert.equal(patched.html, expected, token);
      assert.equal(patched.applied, true);
      const again = applyScreenPatch(patched.html, "home", inner);
      assert.equal(again.html, expected);
      assert.equal(again.applied, false);
      assert.equal(again.reason, "unchanged");
    }
  });

  it("refuses structurally impossible patches on the truncated Vesti fixture", () => {
    assert.equal(hasScreenTarget(INVALID, "home"), true);
    assert.equal(hasScreenTarget(INVALID, "list"), true);
    assert.equal(hasScreenTarget(INVALID, "new"), false);
    assert.equal(hasScreenTarget(INVALID, "stats"), false);
    assert.equal(hasScreenTarget(INVALID, "more"), false);
    const miss = applyScreenPatch(INVALID, "new", "<p>form capo</p>");
    assert.equal(miss.applied, false);
    assert.equal(miss.reason, "absent");
    assert.equal(miss.html, INVALID);
    const css = applyScreenPatch(VALID, "home", ".fk-tab { color: red }");
    assert.equal(css.applied, false);
    assert.equal(css.reason, "css-dump");
    const ok = applyScreenPatch(VALID, "new", "<p>Nuovo capo</p>");
    assert.equal(ok.applied, true);
    assert.match(ok.html, /<template[^>]*id=["']t-new["'][^>]*>\s*<p>Nuovo capo<\/p>\s*<\/template>/i);
    const same = applyScreenPatch(VALID, "more", "");
    assert.equal(same.applied, false);
    assert.equal(same.reason, "empty");
  });

  it("treats a no-op splice as unchanged, not absent, and remaps a missing returned SCREEN id", () => {
    const inner = VALID.match(/<template[^>]*id=["']t-home["'][^>]*>([\s\S]*?)<\/template>/i)?.[1] || "";
    const noop = applyScreenPatch(VALID, "home", inner);
    assert.equal(noop.applied, false);
    assert.equal(noop.reason, "unchanged");
    assert.equal(resolvePatchTarget(PRODUCTION, "new", "stats"), "stats");
    assert.equal(resolvePatchTarget(INVALID, "stats", "stats"), "stats");
    assert.equal(resolvePatchTarget(INVALID, "new", "ghost"), "new");
    assert.equal(resolvePatchTarget(PRODUCTION, "new", "ghost"), "new");
    assert.equal(hasScreenTarget(PRODUCTION, "new"), true);
    assert.equal(hasScreenTarget(PRODUCTION, "stats"), true);
    assert.equal(hasScreenTarget(PRODUCTION, "more"), true);
  });

  it("deduplicates nodo-assente logs and the worker skips grok when the target is missing", () => {
    const absent = new Set<string>();
    const log: string[] = [];
    for (const id of TAB_IDS) {
      if (!hasScreenTarget(INVALID, id)) noteAbsent(absent, log, id, false);
    }
    for (const id of TAB_IDS) {
      if (!hasScreenTarget(INVALID, id)) noteAbsent(absent, log, id, true);
    }
    assert.deepEqual(
      log.filter((line) => /nodo assente/.test(line)),
      [
        "Patch new ignorata: nodo assente",
        "Patch stats ignorata: nodo assente",
        "Patch more ignorata: nodo assente",
      ],
    );
    const extraTried = new Set<string>(["new"]);
    assert.equal(shouldPolishTab(INVALID, "new", absent, extraTried), false);
    assert.equal(shouldPolishTab(PRODUCTION, "new", new Set(), extraTried), false);
    assert.equal(shouldPolishTab(PRODUCTION, "new", new Set(), new Set()), true);
    assert.match(WORKER, /from "\.\/screen-patch\.mjs"/);
    assert.match(WORKER, /shouldPolishTab\(current, tabId, absent\)/);
    assert.match(WORKER, /resolvePatchTarget\(current, tabId, screen\.id\)/);
    assert.match(WORKER, /extraTried/);
    assert.match(WORKER, /noteSkip\(skipSeen/);
    assert.doesNotMatch(WORKER, /<template id="t-\$\{tid\}">/);
    assert.doesNotMatch(WORKER, /screen\.id \|\| tabId/);
  });
});
