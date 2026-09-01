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
} from "../../../workers/visual/screen-patch.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const INVALID = readFileSync(join(here, "fixtures/vesti-invalid-collection.html"), "utf8");
const VALID = readFileSync(join(here, "fixtures/vesti.html"), "utf8");
const WORKER = readFileSync(join(here, "../../../workers/visual/server.mjs"), "utf8");

describe("visual worker screen patches", () => {
  it("refuses structurally impossible patches on the Vesti production fixture", () => {
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
    assert.match(WORKER, /from "\.\/screen-patch\.mjs"/);
    assert.match(WORKER, /if \(!hasScreenTarget\(current, tabId\)\)/);
    assert.match(WORKER, /noteAbsent\(absent, log, tabId/);
    assert.doesNotMatch(WORKER, /<template id="t-\$\{tid\}">/);
  });
});
