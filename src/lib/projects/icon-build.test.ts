import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { AGENDA_ICON_INSTRUCTION } from "../../../workers/visual/icon-patch.mjs";
import { ITERATE_COST } from "./credits.ts";
import { runIconRevisionFlow, type IconBuildIO, type IconBuildProject } from "./icon-build.ts";
import { isStudioLocked } from "./studio-lock.ts";

const here = dirname(fileURLToPath(import.meta.url));
const AGENDA = readFileSync(join(here, "fixtures/agenda.html"), "utf8");
const FLOW_SRC = readFileSync(join(here, "icon-build.ts"), "utf8");

function mockIo(init: IconBuildProject, settle: () => Promise<string | null>): {
  io: IconBuildIO;
  state: { project: IconBuildProject; credits: number; messages: string[] };
} {
  const state = {
    project: { ...init, html: init.html, files: init.files ? [...init.files] : [] },
    credits: 40,
    messages: [] as string[],
  };
  const io: IconBuildIO = {
    spendCredit: (n) => {
      if (state.credits < n) return false;
      state.credits -= n;
      return true;
    },
    refundCredit: (n) => {
      if (state.project.creditRefunded) return false;
      state.credits += n;
      state.project.creditRefunded = true;
      return true;
    },
    getProject: () => state.project,
    updateProject: (patch) => {
      state.project = { ...state.project, ...patch };
    },
    addMessage: (content) => {
      state.messages.push(content);
    },
    settleBoot: settle,
  };
  return { io, state };
}

async function withFetchSpy<T>(fn: (calls: string[]) => Promise<T>): Promise<T> {
  const calls: string[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(`${String(init?.method || "GET")} ${String(input)}`);
    throw new Error("POST/model/worker vietata sul path icona");
  }) as typeof fetch;
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = orig;
  }
}

describe("icon revision flow: local patch, zero POST", () => {
  it("source never imports fetch, consumeStream, or the visual worker client", () => {
    assert.doesNotMatch(FLOW_SRC, /\bfetch\s*\(/);
    assert.doesNotMatch(FLOW_SRC, /consumeStream/);
    assert.doesNotMatch(FLOW_SRC, /repairBootFailures/);
    assert.doesNotMatch(FLOW_SRC, /startPolishJob/);
    assert.doesNotMatch(FLOW_SRC, /\/api\/(?:build|polish)/);
    assert.doesNotMatch(FLOW_SRC, /XAI_API_KEY/);
    assert.match(FLOW_SRC, /settleBoot/);
  });

  it("applies one icon, spends once, never posts, overlay locks while building", async () => {
    await withFetchSpy(async (calls) => {
      const files = [
        { path: "index.html", content: AGENDA },
        { path: "src/screens/Home.tsx", content: "keep" },
      ];
      const { io, state } = mockIo({ html: AGENDA, files, creditRefunded: false }, async () => null);
      assert.equal(isStudioLocked({ status: "building" }), true);
      const result = await runIconRevisionFlow(
        { instruction: AGENDA_ICON_INSTRUCTION, html: AGENDA, files, kind: "app", epoch: 2 },
        io,
      );
      assert.equal(result.outcome, "ok", result.reason);
      assert.equal(result.spent, true);
      assert.equal(result.refunded, false);
      assert.equal(result.posts, 0);
      assert.deepEqual(calls, []);
      assert.equal(state.credits, 40 - ITERATE_COST);
      assert.equal(state.project.status, "building");
      assert.match(String(state.project.html), /M8 4v4M16 4v4/);
      assert.equal(
        state.project.files?.find((f) => f.path === "src/screens/Home.tsx")?.content,
        "keep",
      );
      assert.match(result.html, /data-view="home"/);
      assert.match(result.html, /Fenix\.data\.query\("impegni"\)/);
    });
  });

  it("boot-failure restores snapshot, refunds once, keeps Pubblica closed, zero POST", async () => {
    await withFetchSpy(async (calls) => {
      const files = [{ path: "index.html", content: AGENDA }];
      const { io, state } = mockIo(
        { html: AGENDA, files, creditRefunded: false },
        async () => "TypeError: cannot read",
      );
      const result = await runIconRevisionFlow(
        { instruction: AGENDA_ICON_INSTRUCTION, html: AGENDA, files, kind: "app", epoch: 3 },
        io,
      );
      assert.equal(result.outcome, "boot-fail");
      assert.equal(result.spent, true);
      assert.equal(result.refunded, true);
      assert.equal(result.posts, 0);
      assert.deepEqual(calls, []);
      assert.equal(state.credits, 40);
      assert.equal(state.project.status, "error");
      assert.equal(state.project.html, AGENDA);
      assert.match(String(state.project.error), /TypeError/);
      assert.match(state.messages.join(" "), /Nessuna seconda POST/);
      assert.equal(isStudioLocked({ status: "error" }), false);
      const again = io.refundCredit(ITERATE_COST);
      assert.equal(again, false);
      assert.equal(state.credits, 40);
    });
  });

  it("absent target spends nothing and never posts", async () => {
    await withFetchSpy(async (calls) => {
      const html = AGENDA.replace(
        /<button type="button" data-view="home"[\s\S]*?<\/button>/,
        "",
      ).replace(/data-fenix-id="icon:home"/g, "");
      const { io, state } = mockIo({ html, creditRefunded: false }, async () => null);
      const result = await runIconRevisionFlow({ instruction: AGENDA_ICON_INSTRUCTION, html }, io);
      assert.equal(result.outcome, "noop");
      assert.equal(result.spent, false);
      assert.equal(state.credits, 40);
      assert.deepEqual(calls, []);
      assert.match(result.reason, /assente/i);
    });
  });
});
