import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  VISUAL_JOB_TTL_MS,
  clearVisualJobPatch,
  hasActiveVisualJob,
  visualJobPatch,
} from "./visual-job.ts";

describe("hasActiveVisualJob", () => {
  it("is true for a live run job and false after TTL or clear", () => {
    const now = 1_700_000_000_000;
    assert.equal(hasActiveVisualJob({}, now), false);
    assert.equal(
      hasActiveVisualJob(
        { visualJobId: "job-1", visualJobStatus: "run", visualJobStartedAt: now - 5_000 },
        now,
      ),
      true,
    );
    assert.equal(
      hasActiveVisualJob(
        {
          visualJobId: "job-1",
          visualJobStatus: "run",
          visualJobStartedAt: now - VISUAL_JOB_TTL_MS - 1,
        },
        now,
      ),
      false,
    );
    assert.equal(
      hasActiveVisualJob(
        { visualJobId: "job-1", visualJobStatus: "ok", visualJobStartedAt: now },
        now,
      ),
      false,
    );
    const patch = visualJobPatch("job-9", "run", now);
    assert.equal(hasActiveVisualJob(patch, now), true);
    assert.equal(hasActiveVisualJob({ ...patch, ...clearVisualJobPatch() }, now), false);
  });
});
