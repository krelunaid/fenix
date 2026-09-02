import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { projectFiles } from "./files.ts";
import {
  MAX_PROJECT_ACTIVITY,
  activityHasOnlySafeKeys,
  appendProjectActivity,
  formatActivityAge,
  listProjectActivity,
  projectDiagnostics,
  redactActivityText,
  serializeProjectDiagnostics,
  summarizeProjectActivity,
} from "./activity.ts";
import { FASE3_GAPS, fase3NowGaps } from "./fase3-gap.ts";
import { FASE3_SCORECARD, fase3Score, scoreDimension } from "./fase3-scorecard.ts";
import {
  MAX_REVISIONS,
  branchProjectRevision,
  captureRevision,
  commitIfChanged,
  formatRevisionAge,
  mergeProjectBranch,
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
      ["revisions", "project-tree", "github-export", "collab", "quality"],
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
    const observability = FASE3_GAPS.find((g) => g.id === "observability");
    assert.equal(observability?.slice, "next");
    assert.match(observability?.fenix || "", /registro|redatt|attivit/i);
  });

  it("scores only cited, reproducible evidence and keeps the 100-point ceiling honest", () => {
    const total = fase3Score();
    assert.deepEqual(
      FASE3_SCORECARD.map((dimension) => dimension.max),
      [20, 15, 15, 15, 15, 20],
    );
    assert.equal(total.max, 100);
    assert.equal(total.score, 96);
    assert.equal(total.complete, false);
    for (const dimension of FASE3_SCORECARD) {
      assert.ok(scoreDimension(dimension) <= dimension.max);
      assert.ok(dimension.remaining.length >= 30);
      assert.ok(dimension.evidence.length > 0);
      for (const row of dimension.evidence) {
        assert.ok(row.points > 0);
        assert.match(row.reproduce, /npm (?:test|run)/);
        assert.doesNotMatch(`${row.claim} ${dimension.remaining}`, /parit[aà]|feature-complete/i);
      }
    }
  });
});

describe("project activity evidence", () => {
  it("redacts secrets, allowlists metrics, deduplicates bursts and stays bounded", () => {
    let project = appendProjectActivity(sample(), {
      kind: "error",
      outcome: "err",
      label: "Worker error",
      detail: "Authorization: Bearer xai-secretvalue token=abc123456 password=hunter2",
      metrics: { rows: 4.4, durable: 3, ignored: 99 },
      at: 1,
      id: "first",
    });
    assert.doesNotMatch(JSON.stringify(project.activity), /secretvalue|abc123456|hunter2/);
    assert.deepEqual(project.activity?.[0]?.metrics, { durable: 3, rows: 4 });
    assert.equal(activityHasOnlySafeKeys(project.activity![0]!), true);
    const diagnosticProject: Project = {
      ...project,
      prompt: "non esportare questo prompt",
      messages: [{ id: "m1", role: "user", content: "messaggio privato", at: 1 }],
      visualJobId: "job-private",
    };
    const diagnostic = projectDiagnostics(diagnosticProject, 1_700_000_000_000);
    assert.equal(diagnostic.schema, "fenix-diagnostics-v1");
    assert.equal(diagnostic.generatedAt, "2023-11-14T22:13:20.000Z");
    assert.deepEqual(diagnostic.summary, {
      events: 1,
      ok: 0,
      err: 1,
      run: 0,
      info: 0,
      credits: 0,
      refunds: 0,
    });
    assert.equal(diagnostic.activity[0]?.label, "Worker error");
    assert.doesNotMatch(
      serializeProjectDiagnostics(diagnosticProject, 1_700_000_000_000),
      /prompt|messages|html|files\"\s*: \[|visualJob|secretvalue|abc123456|hunter2/i,
    );
    project = appendProjectActivity(project, {
      kind: "data",
      outcome: "ok",
      label: "Dati · clienti",
      detail: "Scrittura durevole verificata",
      metrics: { rows: 1 },
      dedupe: "data:clienti",
      at: 10,
    });
    project = appendProjectActivity(project, {
      kind: "data",
      outcome: "ok",
      label: "Dati · clienti",
      detail: "Scrittura durevole verificata",
      metrics: { rows: 8 },
      dedupe: "data:clienti",
      at: 11,
    });
    assert.equal(project.activity?.length, 2);
    assert.equal(project.activity?.at(-1)?.metrics?.rows, 8);
    assert.deepEqual(summarizeProjectActivity(project), {
      events: 2,
      ok: 1,
      err: 1,
      run: 0,
      info: 0,
      credits: 0,
      refunds: 0,
    });
    for (let i = 0; i < MAX_PROJECT_ACTIVITY + 8; i += 1) {
      project = appendProjectActivity(project, {
        kind: "build",
        outcome: "run",
        label: `Build ${i}`,
        at: 10_000 + i * 3_000,
      });
    }
    assert.equal(project.activity?.length, MAX_PROJECT_ACTIVITY);
    assert.equal(listProjectActivity(project)[0]?.label, `Build ${MAX_PROJECT_ACTIVITY + 7}`);
    assert.equal(formatActivityAge(1_000, 121_000), "2 min fa");
    assert.equal(redactActivityText("api_key=hello-secret"), "api_key=[redacted]");
  });

  it("does not copy source activity into a pure revision branch", () => {
    let source = appendProjectActivity(sample(), {
      kind: "publish",
      outcome: "ok",
      label: "Snapshot pubblicato",
      detail: "private operational history",
      at: 1,
    });
    source = commitIfChanged(source, { source: "build", label: "Pronto", id: "activity-rev" });
    const branch = branchProjectRevision(source, "activity-rev", { id: "activity-branch", at: 2 });
    assert.ok(branch);
    assert.equal(branch!.activity, undefined);
    assert.doesNotMatch(JSON.stringify(branch), /private operational history/);
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

  it("three-way merges independent branch edits without copying operational state", () => {
    const baseHtml = SITE_A.replace(
      "</head>",
      '<link rel="stylesheet" href="css/theme.css"/></head>',
    );
    let source = commitIfChanged(
      sample({
        html: baseHtml,
        files: [
          { path: "index.html", content: baseHtml },
          { path: "css/theme.css", content: "body{letter-spacing:0}" },
          { path: "js/app.js", content: "window.appVersion=1" },
        ],
      }),
      { source: "build", label: "Base", id: "merge-base", at: 1 },
    );
    const branch = branchProjectRevision(source, "merge-base", {
      id: "merge-branch",
      at: 2,
    });
    assert.ok(branch);
    source = {
      ...source,
      files: source.files!.map((file) =>
        file.path === "css/theme.css" ? { ...file, content: "body{letter-spacing:.01em}" } : file,
      ),
      messages: [{ id: "source-chat", role: "user", content: "privato fonte", at: 3 }],
      appData: { clients: [{ secret: "source-only" }] },
      visualJobId: "source-job",
      publishedId: "source-live",
    };
    const editedBranch: Project = {
      ...branch!,
      files: branch!.files!.map((file) =>
        file.path === "js/app.js" ? { ...file, content: "window.appVersion=2" } : file,
      ),
      messages: [{ id: "branch-chat", role: "user", content: "non copiare", at: 4 }],
      appData: { clients: [{ secret: "branch-only" }] },
      visualJobId: "branch-job",
      publishedId: "branch-live",
    };
    const result = mergeProjectBranch(source, editedBranch, { id: "merge-result", at: 5 });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.changed, ["js/app.js"]);
    assert.equal(
      result.project.files?.find((file) => file.path === "css/theme.css")?.content,
      "body{letter-spacing:.01em}",
    );
    assert.equal(
      result.project.files?.find((file) => file.path === "js/app.js")?.content,
      "window.appVersion=2",
    );
    assert.deepEqual(result.project.messages, source.messages);
    assert.deepEqual(result.project.appData, source.appData);
    assert.equal(result.project.visualJobId, "source-job");
    assert.equal(result.project.publishedId, "source-live");
    assert.doesNotMatch(
      JSON.stringify(result.project),
      /branch-only|branch-chat|branch-job|branch-live/,
    );
    assert.match(result.project.revisions?.at(-1)?.label || "", /^Unione ·/);
  });

  it("fails closed on same-file conflicts and never applies a partial merge", () => {
    let source = commitIfChanged(
      sample({
        files: [
          { path: "index.html", content: SITE_A },
          { path: "css/theme.css", content: "body{color:black}" },
        ],
      }),
      { source: "build", label: "Base", id: "conflict-base", at: 1 },
    );
    const branch = branchProjectRevision(source, "conflict-base", {
      id: "conflict-branch",
      at: 2,
    });
    assert.ok(branch);
    source = {
      ...source,
      files: source.files!.map((file) =>
        file.path === "css/theme.css" ? { ...file, content: "body{color:navy}" } : file,
      ),
    };
    const editedBranch: Project = {
      ...branch!,
      files: branch!.files!.map((file) =>
        file.path === "css/theme.css" ? { ...file, content: "body{color:maroon}" } : file,
      ),
    };
    const before = JSON.stringify(source);
    const result = mergeProjectBranch(source, editedBranch, { id: "must-not-exist", at: 3 });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "conflict");
    assert.deepEqual(result.conflicts, [{ path: "css/theme.css", reason: "both-changed" }]);
    assert.equal(JSON.stringify(source), before);
    assert.equal(
      source.revisions?.some((revision) => revision.id === "must-not-exist"),
      false,
    );
  });

  it("recover keeps revisions on a ready project", () => {
    const committed = commitIfChanged(sample(), { source: "build", label: "Pronto", id: "keep" });
    const recovered = recoverPersistedProject(committed);
    assert.equal(recovered.revisions?.length, 1);
    assert.equal(recovered.revisions?.[0]?.id, "keep");
    assert.match(formatRevisionAge(Date.now() - 120_000, Date.now()), /min fa/);
  });
});
