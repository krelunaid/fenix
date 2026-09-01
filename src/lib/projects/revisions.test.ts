import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { projectFiles } from "./files.ts";
import { FASE3_GAPS, fase3NowGaps } from "./fase3-gap.ts";
import {
  MAX_REVISIONS,
  branchProjectRevision,
  captureRevision,
  commitIfChanged,
  formatRevisionAge,
  restoreProjectRevision,
  revisionHasOnlySafeKeys,
  revisionHash,
} from "./revisions.ts";
import { DEFAULT_PALETTE, type Project } from "./types.ts";
import { recoverPersistedProject } from "./recover.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SITE_A = readFileSync(join(here, "fixtures/music-site-no-fenix.html"), "utf8");
const SITE_B = SITE_A.replace("Onda", "Onda Live").replace(
  "Carica e ascolta i tuoi brani.",
  "Ascolta dal vivo.",
);

function sample(over: Partial<Project> = {}): Project {
  const now = 1_720_000_000_000;
  return {
    id: "proj-rev-1",
    name: "Onda",
    tagline: "Musica",
    prompt: "sito musica kind=site",
    kind: "site",
    requestedKind: "site",
    summary: "",
    palette: DEFAULT_PALETTE,
    html: SITE_A,
    files: [{ path: "README.md", content: "# Onda" }],
    messages: [],
    buildLog: [],
    status: "ready",
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

describe("fase3 gap matrix is evidence, not parity", () => {
  it("orders high-impact cheap-enough slices first and does not claim Emergent parity", () => {
    assert.ok(FASE3_GAPS.length >= 8);
    const now = fase3NowGaps();
    assert.deepEqual(
      now.map((g) => g.id),
      ["revisions", "project-tree", "github-export", "quality"],
    );
    assert.equal(now[0]?.impact, "high");
    assert.notEqual(now[0]?.cost, "high");
    assert.equal(now[1]?.impact, "high");
    assert.match(now[1]?.fenix || "", /POSIX|albero|ZIP|entrypoint|index\.html/i);
    for (const row of FASE3_GAPS) {
      assert.doesNotMatch(row.fenix, /parit[aà]|feature-complete|uguale a Emergent/i);
    }
    const github = FASE3_GAPS.find((g) => g.id === "github-export");
    assert.equal(github?.slice, "now");
    assert.match(github?.fenix || "", /GitHub App|non configurato|ZIP/i);
    assert.doesNotMatch(github?.fenix || "", /parit[aà]|feature-complete/i);
  });
});

describe("project tree and revisions", () => {
  it("projectFiles injects index.html and keeps extra files", () => {
    const tree = projectFiles({
      html: SITE_A,
      files: [{ path: "css/app.css", content: "body{margin:0}" }],
    });
    assert.equal(tree[0]?.path, "index.html");
    assert.ok(tree.some((f) => f.path === "css/app.css"));
  });

  it("skips an identical second commit and caps the log", () => {
    let project = commitIfChanged(sample(), { source: "build", label: "Pronto", id: "r1", at: 1 });
    assert.equal(project.revisions?.length, 1);
    const again = commitIfChanged(project, {
      source: "polish",
      label: "Rifinitura",
      id: "r2",
      at: 2,
    });
    assert.equal(again.revisions?.length, 1);
    assert.equal(again.revisionId, "r1");
    for (let i = 0; i < MAX_REVISIONS + 4; i++) {
      project = commitIfChanged(
        { ...project, html: `${SITE_A}<!-- ${i} -->` },
        { source: "polish", label: `n${i}`, id: `x${i}`, at: 10 + i },
      );
    }
    assert.equal(project.revisions?.length, MAX_REVISIONS);
    assert.equal(project.revisions?.[0]?.id, "x4");
  });

  it("restore keeps later cotture so you can go forward again", () => {
    let project = commitIfChanged(sample({ html: SITE_A }), {
      source: "build",
      label: "Pronto",
      id: "old",
      at: 1,
    });
    project = commitIfChanged(
      { ...project, html: SITE_B, name: "Onda Live" },
      { source: "polish", label: "Rifinitura", id: "new", at: 2 },
    );
    assert.equal(project.revisions?.length, 2);
    const restored = restoreProjectRevision(project, "old");
    assert.ok(restored);
    assert.match(restored!.html, /Carica e ascolta i tuoi brani/);
    assert.equal(restored!.name, "Onda");
    const labels = restored!.revisions!.map((r) => r.label);
    assert.ok(labels.includes("Pronto"));
    assert.ok(labels.includes("Rifinitura") || labels.includes("Prima del ripristino"));
    assert.ok(labels.some((l) => /Ripristino/.test(l)));
    const hashes = new Set(restored!.revisions!.map((r) => r.hash));
    assert.ok(hashes.size >= 2);
  });

  it("captures only the allowlisted keys and never job ids or messages", () => {
    const rev = captureRevision(
      sample({
        visualJobId: "job-secret",
        messages: [{ id: "m", role: "user", content: "sk-abc", at: 1 }],
      }),
      {
        source: "build",
        label: "Pronto",
      },
    );
    assert.ok(rev);
    assert.equal(revisionHasOnlySafeKeys(rev!), true);
    assert.equal("visualJobId" in rev!, false);
    assert.equal("messages" in rev!, false);
    assert.doesNotMatch(JSON.stringify(rev), /sk-abc|job-secret|BEGIN PRIVATE/);
    const a = revisionHash({ html: SITE_A, files: [], name: "Onda", palette: DEFAULT_PALETTE });
    const b = revisionHash({ html: SITE_B, files: [], name: "Onda", palette: DEFAULT_PALETTE });
    assert.notEqual(a, b);
  });

  it("branches an exact cottura without copying data, chat, jobs or deploy identity", () => {
    let source = commitIfChanged(sample({ html: SITE_A }), {
      source: "build",
      label: "Pronto",
      id: "branch-old",
      at: 1,
    });
    source = commitIfChanged(
      {
        ...source,
        html: SITE_B,
        files: [{ path: "index.html", content: SITE_B }],
        messages: [{ id: "secret-message", role: "user", content: "dato privato", at: 2 }],
        appData: { items: [{ private: true }] },
        visualJobId: "worker-job",
        visualJobStatus: "ok",
        publishedId: "live-site",
      },
      { source: "polish", label: "Rifinitura", id: "branch-new", at: 2 },
    );
    const branch = branchProjectRevision(source, "branch-old", {
      id: "project-branch",
      at: 3,
    });
    assert.ok(branch);
    assert.equal(branch!.id, "project-branch");
    assert.deepEqual(branch!.branchFrom, {
      projectId: source.id,
      revisionId: "branch-old",
    });
    assert.equal(branch!.html, SITE_A.trim());
    assert.equal(branch!.name, "Onda · ramo");
    assert.equal(branch!.status, "ready");
    assert.deepEqual(branch!.messages, []);
    assert.deepEqual(branch!.buildLog, []);
    assert.equal(branch!.appData, undefined);
    assert.equal(branch!.visualJobId, undefined);
    assert.equal(branch!.visualJobStatus, undefined);
    assert.equal(branch!.publishedId, undefined);
    assert.equal(branch!.revisions?.length, 1);
    assert.match(branch!.revisions?.[0]?.label || "", /^Ramo · Pronto$/);
    assert.equal(source.html, SITE_B);
  });

  it("recover keeps revisions on a ready project", () => {
    const committed = commitIfChanged(sample(), { source: "build", label: "Pronto", id: "keep" });
    const recovered = recoverPersistedProject(committed);
    assert.equal(recovered.revisions?.length, 1);
    assert.equal(recovered.revisions?.[0]?.id, "keep");
    assert.match(formatRevisionAge(Date.now() - 120_000, Date.now()), /min fa/);
  });
});
