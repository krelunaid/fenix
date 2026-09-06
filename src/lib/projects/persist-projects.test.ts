import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeProduct } from "../ai/compose-product.ts";
import { formatPrefix } from "./infer.ts";
import {
  homeVetrinaList,
  mergePersistJson,
  mergeProjectLists,
  pickProjectRevision,
  rescueLiveStudio,
  rememberLiveStudio,
  readLiveStudios,
  compactPersistJson,
} from "./persist-projects.ts";
import { recoverPersistedProject, STALE_BUILD_MS } from "./recover.ts";
import type { Project } from "./types.ts";

const BARBER = `${formatPrefix("app")}App barbiere: agenda tagli e clienti, stile iPhone.`;

function buildingSeed(id: string, html: string, updatedAt = Date.now()): Project {
  return {
    id,
    name: "App barbiere",
    tagline: "",
    prompt: BARBER,
    kind: "app",
    requestedKind: "app",
    summary: "",
    palette: {
      bg: "#0b0908",
      surface: "#16110e",
      fg: "#f4eee6",
      muted: "#b9a894",
      accent: "#d2bfa6",
    },
    html,
    lastStableHtml: html,
    files: [{ path: "index.html", content: html }],
    messages: [],
    buildLog: [],
    status: "building",
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("seeded studio persist union", () => {
  it("keeps a seeded building studio when persist hydrate is empty or stale", () => {
    const composed = composeProduct(BARBER);
    const seeded = buildingSeed("studio-live", composed.html);
    const fromEmpty = mergeProjectLists([], [seeded]);
    assert.equal(fromEmpty.some((p) => p.id === "studio-live"), true);
    assert.ok(fromEmpty[0]?.html.includes("salon-cta-prenota"));

    const staleReady: Project = {
      ...buildingSeed("other", "<html><body>old</body></html>", Date.now() - 60_000),
      status: "ready",
    };
    const merged = mergeProjectLists([staleReady], [seeded]);
    assert.equal(merged.some((p) => p.id === "studio-live" && p.status === "building"), true);
    assert.equal(merged.some((p) => p.id === "other"), true);
  });

  it("does not let an empty persist copy wipe a seeded in-memory studio", () => {
    const composed = composeProduct(BARBER);
    const live = buildingSeed("keep-me", composed.html);
    const emptyPersist = { ...live, html: "", lastStableHtml: undefined, files: undefined, updatedAt: Date.now() + 10 };
    const picked = pickProjectRevision(emptyPersist, live);
    assert.ok(picked.html.includes("data-fenix-shears-fill"));
    assert.ok(picked.lastStableHtml);
    const union = mergeProjectLists([emptyPersist], [live]);
    assert.equal(union[0]?.id, "keep-me");
    assert.ok(String(union[0]?.html || "").includes("Prenota"));
  });

  it("home and vetrina keep a building seeded studio while polish runs", () => {
    const composed = composeProduct(BARBER);
    const seeded = buildingSeed("vetrina-seed", composed.html);
    const hidden = homeVetrinaList([seeded], false);
    assert.equal(hidden.length, 0);
    const list = homeVetrinaList([seeded], true);
    assert.equal(list.length, 1);
    assert.equal(list[0]?.status, "building");
    assert.match(list[0]?.html || "", /salon-cta-prenota/);
    assert.match(list[0]?.html || "", /data-fenix-shears-fill/);
    const recovered = recoverPersistedProject(seeded);
    assert.equal(recovered.status, "building");
    assert.equal(homeVetrinaList([recovered], true).some((p) => p.id === "vetrina-seed"), true);
  });

  it("still lists a seeded studio after the durable stale timeout (error, not gone)", () => {
    const composed = composeProduct(BARBER);
    const stale = buildingSeed("stale-seed", composed.html, Date.now() - STALE_BUILD_MS - 5_000);
    const recovered = recoverPersistedProject(stale);
    assert.equal(recovered.status, "error");
    assert.ok(recovered.html.includes("Prenota"));
    const list = homeVetrinaList(mergeProjectLists([], [recovered]), true);
    assert.equal(list.some((p) => p.id === "stale-seed"), true);
  });

  it("merges persist JSON blobs so a live seed survives a quota-empty localStorage", () => {
    const composed = composeProduct(BARBER);
    const seeded = buildingSeed("json-seed", composed.html);
    const liveBlob = JSON.stringify({ state: { projects: [seeded] }, version: 3 });
    const emptyLocal = JSON.stringify({ state: { projects: [], creditsRemaining: 80 }, version: 3 });
    const merged = mergePersistJson(emptyLocal, liveBlob);
    assert.ok(merged);
    const bag = JSON.parse(merged) as { state: { projects: Project[] } };
    assert.equal(bag.state.projects.some((p) => p.id === "json-seed" && /Prenota/.test(p.html)), true);
    const localOnly = buildingSeed("local-first", composed.html, 100);
    const staleSession = { ...localOnly, html: "", lastStableHtml: undefined, files: undefined };
    const preferLocal = mergePersistJson(
      JSON.stringify({ state: { projects: [localOnly] }, version: 3 }),
      JSON.stringify({ state: { projects: [staleSession] }, version: 3 }),
    );
    const preferBag = JSON.parse(preferLocal || "{}") as { state: { projects: Project[] } };
    assert.ok(preferBag.state.projects[0]?.html.includes("Prenota"));
    const compact = compactPersistJson(liveBlob);
    assert.match(compact, /json-seed/);
  });
});

describe("live studio session rescue", () => {
  it("remembers and rescues a seeded studio from sessionStorage", () => {
    const memory = new Map<string, string>();
    const fake = {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => {
        memory.set(k, v);
      },
      removeItem: (k: string) => {
        memory.delete(k);
      },
    };
    (globalThis as { sessionStorage?: typeof fake }).sessionStorage = fake;
    const composed = composeProduct(BARBER);
    const seeded = buildingSeed("rescue-me", composed.html);
    rememberLiveStudio(seeded);
    assert.equal(readLiveStudios().some((p) => p.id === "rescue-me"), true);
    const rescued = rescueLiveStudio("rescue-me");
    assert.ok(rescued);
    assert.equal(rescued.status, "building");
    assert.match(rescued.html, /salon-cta-prenota/);
    delete (globalThis as { sessionStorage?: typeof fake }).sessionStorage;
  });
});
