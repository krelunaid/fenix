import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  EXIT_LABEL,
  LOCKED_CONTROLS,
  LOCK_COPY,
  STALE_JOB,
  captureStableSnapshot,
  isCurrentBuild,
  isLockFocusAllowed,
  isStudioLocked,
  lockStageLabel,
  nextBuildEpoch,
  readPersistedBuild,
  restoreStablePatch,
} from "./studio-lock.ts";
import { VISUAL_JOB_TTL_MS } from "./visual-job.ts";

const here = dirname(fileURLToPath(import.meta.url));
const VALID = readFileSync(join(here, "fixtures/valid-app.html"), "utf8");
const BROKEN = readFileSync(join(here, "fixtures/broken-flusso.html"), "utf8");

describe("studio lock contract", () => {
  it("locks building and live jobs, never ready/error", () => {
    const now = 1_700_000_000_000;
    assert.equal(isStudioLocked({ status: "building" }, now), true);
    assert.equal(
      isStudioLocked(
        {
          status: "building",
          visualJobId: "job-1",
          visualJobStatus: "run",
          visualJobStartedAt: now,
        },
        now,
      ),
      true,
    );
    assert.equal(isStudioLocked({ status: "ready", html: VALID }, now), false);
    assert.equal(isStudioLocked({ status: "error", error: "no" }, now), false);
    assert.equal(
      isStudioLocked(
        {
          status: "error",
          visualJobId: "job-old",
          visualJobStatus: "run",
          visualJobStartedAt: now - VISUAL_JOB_TTL_MS - 1,
        },
        now,
      ),
      false,
    );
  });

  it("names real stages and never a fake percent", () => {
    assert.equal(lockStageLabel([]), "Direzione visiva");
    assert.equal(lockStageLabel(["Scrivo le schermate"]), "Codice");
    assert.equal(lockStageLabel(["QA checklist"]), "QA");
    assert.equal(lockStageLabel(["Motore visivo in sottofondo"]), "Rifinitura");
    assert.equal(LOCK_COPY, "Fenix sta creando");
    assert.doesNotMatch(LOCK_COPY, /%/);
    assert.equal(STALE_JOB, "STALE_JOB");
    assert.equal(EXIT_LABEL, "Torna agli studi");
    assert.deepEqual([...LOCKED_CONTROLS], ["Codice", "Versioni", "Condividi", "Esporta", "Pubblica"]);
  });

  it("captures syntax-ok html as lastStable and ignores broken drafts", () => {
    const ok = captureStableSnapshot({ html: VALID, files: [{ path: "index.html", content: VALID }] });
    assert.equal(ok.lastStableHtml, VALID);
    assert.equal(ok.lastStableFiles?.[0]?.path, "index.html");
    const keep = captureStableSnapshot({
      html: BROKEN,
      lastStableHtml: VALID,
      lastStableFiles: [{ path: "index.html", content: VALID }],
    });
    assert.equal(keep.lastStableHtml, VALID);
    const empty = captureStableSnapshot({ html: "" });
    assert.equal(empty.lastStableHtml, undefined);
  });

  it("restores exactly the last stable snapshot and skips when missing", () => {
    assert.deepEqual(restoreStablePatch({}), {});
    assert.deepEqual(restoreStablePatch({ lastStableHtml: VALID }), { html: VALID });
    assert.deepEqual(
      restoreStablePatch({
        lastStableHtml: VALID,
        lastStableFiles: [{ path: "index.html", content: VALID }],
      }),
      { html: VALID, files: [{ path: "index.html", content: VALID }] },
    );
  });

  it("latest-job-wins: stale epoch or job id cannot apply", () => {
    assert.equal(isCurrentBuild({ buildEpoch: 2, visualJobId: "b" }, 2, "b"), true);
    assert.equal(isCurrentBuild({ buildEpoch: 2, visualJobId: "b" }, 1, "a"), false);
    assert.equal(isCurrentBuild({ buildEpoch: 2, visualJobId: "b" }, 2, "a"), false);
    assert.equal(
      isCurrentBuild({ buildEpoch: 2, visualJobId: "b" }, 2, "b", { buildEpoch: 3, visualJobId: "c" }),
      false,
    );
    assert.equal(isCurrentBuild(undefined, 1, "a"), false);
    assert.equal(nextBuildEpoch(undefined), 1);
    assert.equal(nextBuildEpoch(4), 5);
  });

  it("reads persisted epoch so a newer tab wins without a second spend", () => {
    const blob = JSON.stringify({
      state: {
        projects: [{ id: "p1", buildEpoch: 4, visualJobId: "job-new" }],
      },
    });
    const persisted = readPersistedBuild("p1", () => blob);
    assert.equal(persisted?.buildEpoch, 4);
    assert.equal(persisted?.visualJobId, "job-new");
    assert.equal(
      isCurrentBuild({ buildEpoch: 3, visualJobId: "job-old" }, 3, "job-old", persisted),
      false,
    );
    assert.equal(readPersistedBuild("missing", () => blob), undefined);
    assert.equal(readPersistedBuild("p1", () => "not-json"), undefined);
  });

  it("allows focus only inside the lock or on the exit control", () => {
    const lock = { contains: (n: Node) => n === lockChild } as unknown as HTMLElement;
    const lockChild = { nodeType: 1 } as unknown as HTMLElement;
    const back = {
      closest: (sel: string) => (sel.includes(EXIT_LABEL) ? back : null),
    } as unknown as HTMLElement;
    const other = { closest: () => null } as unknown as HTMLElement;
    assert.equal(isLockFocusAllowed(lockChild, lock), true);
    assert.equal(isLockFocusAllowed(back, lock), true);
    assert.equal(isLockFocusAllowed(other, lock), false);
    assert.equal(isLockFocusAllowed(null, lock), false);
  });
});
