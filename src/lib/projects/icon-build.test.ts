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

function mockIo(init: IconBuildProject, settle: () => Promise<string | null>): {
  io: IconBuildIO;
  state: { project: IconBuildProject; credits: number; posts: number; messages: string[] };
} {
  const state = {
    project: { ...init, html: init.html, files: init.files ? [...init.files] : [] },
    credits: 40,
    posts: 0,
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
    post: async () => {
      state.posts += 1;
      throw new Error("POST/model/worker vietata sul path icona");
    },
  };
  return { io, state };
}

describe("icon revision flow: local patch, zero POST", () => {
  it("applies one icon, spends once, never posts, overlay locks while building", async () => {
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
    assert.equal(state.posts, 0);
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

  it("boot-failure restores snapshot, refunds once, keeps Pubblica closed, zero POST", async () => {
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
    assert.equal(state.posts, 0);
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

  it("absent target spends nothing and never posts", async () => {
    const html = AGENDA.replace(/data-fenix-id="icon:home"/g, "").replace(
      /data-view="home"/g,
      'data-view="ghost"',
    );
    const { io, state } = mockIo({ html, creditRefunded: false }, async () => null);
    const result = await runIconRevisionFlow({ instruction: AGENDA_ICON_INSTRUCTION, html }, io);
    assert.equal(result.outcome, "noop");
    assert.equal(result.spent, false);
    assert.equal(state.credits, 40);
    assert.equal(state.posts, 0);
    assert.match(result.reason, /assente/i);
  });
});
