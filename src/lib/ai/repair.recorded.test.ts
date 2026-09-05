import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parseBuildOutput } from "./parse.ts";
import { gateBuildResult, repairBuild } from "./repair.ts";
import { CONTRACT_REPAIR_MAX } from "./build-contract.ts";
import { prepareSrcDoc } from "../projects/color-scheme.ts";
import { looksLikeIosWidgetHome } from "../projects/craft-icons.ts";
import { artifactContext, completeResponseText, MAX_ARTIFACT_CHARS } from "../../../workers/visual/artifact-context.mjs";

/** Recorded polish/repair path. Not live-verified against xAI. */
export const POLISH_REPAIR_LIVE_VERIFIED = false as const;

const here = dirname(fileURLToPath(import.meta.url));
const RECORDED_DIR = join(here, "fixtures/recorded");
const SITE_BRIEF = "FORMATO: sito web. kind=site. sito di musica";

function loadRecorded(name: string): string {
  return readFileSync(join(RECORDED_DIR, name), "utf8");
}

function mockCompletion(content: string): Response {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as Response;
}

describe("polish/repair recorded responses (not live-verified)", () => {
  it("preserves full context at old truncation boundaries and refuses oversize artifacts", () => {
    for (const size of [12000, 20000, 40000, 90000, MAX_ARTIFACT_CHARS]) {
      const html = '<html>' + 'x'.repeat(size - 13) + '</html>';
      assert.equal(html.length, size);
      assert.equal(artifactContext(html), html);
    }
    assert.throws(() => artifactContext('x'.repeat(MAX_ARTIFACT_CHARS + 1)), RangeError);
    for (const reason of ['length', 'content_filter', 'tool_calls']) {
      assert.throws(() => completeResponseText({choices:[{finish_reason:reason,message:{content:'partial'}}]}), /incompleta/);
    }
    assert.equal(completeResponseText({choices:[{finish_reason:'stop',message:{content:'whole'}}]}), 'whole');
  });

  it("sends repair the complete 45k document and rejects explicit incomplete responses", async () => {
    const html = '<html><body>' + ' '.repeat(45000) + '<button id="tail">Save</button><script>window.tail=true</script></body></html>';
    const prev = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      const user = body.messages.find((m: {role:string}) => m.role === 'user');
      assert.ok(user.content.includes(html), 'complete document must reach repair');
      return {ok:true,json:async () => ({choices:[{finish_reason:'length',message:{content:loadRecorded('complete-site.txt')}}]})} as Response;
    }) as typeof fetch;
    try {
      assert.equal(await repairBuild({apiKey:'fixture-unused',prompt:SITE_BRIEF,html,error:'fixture'}), null);
      assert.equal(calls, 1);
      assert.equal(await repairBuild({apiKey:'fixture-unused',prompt:SITE_BRIEF,html:'x'.repeat(MAX_ARTIFACT_CHARS + 1),error:'fixture'}), null);
      assert.equal(calls, 1, 'oversize must not spend a model call');
    } finally { globalThis.fetch = prev; }
  });

  it("parses a declared worker-shaped payload through parseBuildOutput and gates it without fetching xAI", async () => {
    assert.equal(POLISH_REPAIR_LIVE_VERIFIED, false);
    const manifest = JSON.parse(loadRecorded("manifest.json")) as {
      liveVerified: boolean;
      provenance: string;
    };
    assert.equal(manifest.liveVerified, false);
    assert.match(manifest.provenance, /Not live xAI/);
    const recorded = loadRecorded("complete-site.txt");
    const parsed = parseBuildOutput(recorded, "site", SITE_BRIEF);
    assert.ok(parsed, "parseBuildOutput must accept the declared worker-shaped fixture");
    assert.equal(parsed.kind, "site");
    assert.match(parsed.html, /<section\b/i);
    let fetchHits = 0;
    const prev = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchHits += 1;
      throw new Error("xAI fetch forbidden in recorded mock");
    }) as typeof fetch;
    try {
      const gated = await gateBuildResult({
        apiKey: "unused",
        prompt: SITE_BRIEF,
        result: parsed,
        repair: async () => {
          throw new Error("complete payload must not repair");
        },
      });
      assert.equal(fetchHits, 0, "must not call xAI");
      assert.equal("error" in gated, false, (gated as { error?: string }).error);
      if ("error" in gated) throw new Error(gated.error);
      assert.match(gated.result.html, /data-fenix-adapter|window\.Fenix/);
      assert.equal(gated.report.ok, true);
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("repairs an incomplete payload once through repairBuild with injected mock transport", async () => {
    assert.equal(POLISH_REPAIR_LIVE_VERIFIED, false);
    assert.equal(CONTRACT_REPAIR_MAX, 2);
    const incomplete = parseBuildOutput(loadRecorded("incomplete-site.txt"), "site", SITE_BRIEF);
    assert.ok(incomplete, "incomplete fixture must still parse");
    const complete = loadRecorded("complete-site.txt");
    let fetchHits = 0;
    const prev = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchHits += 1;
      return mockCompletion(complete);
    }) as typeof fetch;
    try {
      const gated = await gateBuildResult({
        apiKey: "unused",
        prompt: SITE_BRIEF,
        result: incomplete,
        repair: repairBuild,
      });
      assert.equal(fetchHits, 1, "incomplete payload must hit mock repair once");
      assert.equal("error" in gated, false, (gated as { error?: string }).error);
      if ("error" in gated) throw new Error(gated.error);
      assert.match(gated.result.html, /data-fenix-adapter|window\.Fenix/);
      assert.match(gated.result.html, /<nav\b/i);
      assert.equal(gated.report.ok, true);
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("stops after CONTRACT_REPAIR_MAX=2 when the mock repair stays invalid", async () => {
    assert.equal(CONTRACT_REPAIR_MAX, 2);
    const incomplete = parseBuildOutput(loadRecorded("incomplete-site.txt"), "site", SITE_BRIEF);
    assert.ok(incomplete);
    const stillBroken = loadRecorded("incomplete-site.txt");
    let fetchHits = 0;
    const prev = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchHits += 1;
      return mockCompletion(stillBroken);
    }) as typeof fetch;
    try {
      const gated = await gateBuildResult({
        apiKey: "unused",
        prompt: SITE_BRIEF,
        result: incomplete,
        repair: repairBuild,
      });
      assert.equal(fetchHits, CONTRACT_REPAIR_MAX);
      assert.equal("error" in gated, true, "gate must fail after max repairs");
      if (!("error" in gated)) throw new Error("expected gate error");
      assert.match(gated.error, /completo|sezioni|navigazione|Fenix/i);
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("rejects an invalid payload from parser and from repairBuild", async () => {
    const invalid = loadRecorded("invalid.txt");
    assert.equal(parseBuildOutput(invalid, "site", SITE_BRIEF), null);
    let fetchHits = 0;
    const prev = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchHits += 1;
      return mockCompletion(invalid);
    }) as typeof fetch;
    try {
      const repaired = await repairBuild({
        apiKey: "unused",
        prompt: SITE_BRIEF,
        html: "<p>vuoto</p>",
        error: "HTML assente o troppo corto.",
      });
      assert.equal(fetchHits, 1);
      assert.equal(repaired, null);
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("prepareSrcDoc after repairBuild mock rewrites widget home to first-run, not ledger", async () => {
    assert.equal(POLISH_REPAIR_LIVE_VERIFIED, false);
    const brief = "FORMATO: app telefono. kind=app. Taccuino di bottega.";
    const widget = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"/><title>Taccuino</title></head><body>
<main id="main"></main>
<nav class="fk-tab" aria-label="Navigazione"><button data-view="home">Oggi</button><button data-view="new">Nuovo</button></nav>
<script>
var S={items:[],limit:100,team:[]};
var views={
    home:function(){
      return '<div class="fk-panel"><h3>Oggi</h3><div class="fk-grid2"><div class="fk-stat"><b>0</b><span>attivita</span></div><div class="fk-stat"><b>4.5</b><span>ore</span></div><div class="fk-stat"><b>0</b><span>pezzi</span></div><div class="fk-stat"><b>65</b><span>%</span></div></div></div><div class="fk-grid2"><div class="fk-tile"><span>Ultimo</span><b>—</b></div><div class="fk-tile"><span>Stato</span><b>In corso</b></div></div><button type="button" class="fk-btn" data-go="new">Nuova riga</button>';
    },
    new:function(){ return 'x'; }
};
</script>
</body></html>`;
    const complete = `<<<META>>>
{"name":"Taccuino","tagline":"bottega","kind":"app","summary":"note","direction":"inchiostro","palette":{"bg":"#efe6d4","surface":"#f7f1e4","fg":"#1c1712","muted":"#5c5348","accent":"#3d4a1f"}}
<<<HTML>>>
${widget}
<<<END>>>`;
    let fetchHits = 0;
    const prev = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchHits += 1;
      return mockCompletion(complete);
    }) as typeof fetch;
    try {
      const repaired = await repairBuild({
        apiKey: "unused",
        prompt: brief,
        html: "<p>vuoto</p>",
        error: "La home è lo scheletro iPhone.",
      });
      assert.equal(fetchHits, 1, "must hit declared mock transport once");
      assert.ok(repaired, "repairBuild must parse the mock payload");
      assert.equal(looksLikeIosWidgetHome(repaired.html), true);
      const src = prepareSrcDoc(repaired.html, repaired.palette, "repair-chrome", "app");
      assert.equal(looksLikeIosWidgetHome(src), false);
      assert.doesNotMatch(src, /class=\\"fk-ledger\\"|class="fk-ledger"/);
      assert.doesNotMatch(src, /<dt>Voci<\/dt>/);
      assert.match(src, /Niente in lista|in lista/);
      assert.match(src, /border-radius:12px/);
      assert.match(src, /-apple-system/);
      assert.doesNotMatch(src, /#f5f5f7|#0071e3/);
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("keeps explicit system and serif type after mock repairBuild and prepareSrcDoc", async () => {
    assert.equal(POLISH_REPAIR_LIVE_VERIFIED, false);
    const { composeProduct } = await import("./compose-product.ts");
    const { INTENT_SYSTEM_PROMPT, INTENT_SERIF_PROMPT } = await import("../projects/graphic-intent.ts");
    const { formatPrefix } = await import("../projects/infer.ts");
    const systemBrief = `${formatPrefix("app")}${INTENT_SYSTEM_PROMPT}`;
    const serifBrief = `${formatPrefix("app")}${INTENT_SERIF_PROMPT}`;
    const wrap = (name: string, html: string, kind: string) => `<<<META>>>
{"name":"${name}","tagline":"intent","kind":"${kind}","summary":"recorded","direction":"intent","palette":{"bg":"#efe6d4","surface":"#f7f1e4","fg":"#1c1712","muted":"#5c5348","accent":"#3d4a1f"}}
<<<HTML>>>
${html}
<<<END>>>`;
    const systemDropped = composeProduct(systemBrief)
      .html.replace(/--display:[^;]+;/g, '--display:"Karla",sans-serif;')
      .replace(/--body:[^;]+;/g, '--body:"Karla",sans-serif;');
    const serifDropped = composeProduct(serifBrief)
      .html.replace(/--display:[^;]+;/g, '--display:"Figtree",sans-serif;')
      .replace(/--body:[^;]+;/g, '--body:"Figtree",sans-serif;');
    const prev = globalThis.fetch;
    let fetchHits = 0;
    const payloads = [wrap("Lista", systemDropped, "app"), wrap("Atelier", serifDropped, "site")];
    globalThis.fetch = (async () => {
      const content = payloads[Math.min(fetchHits, payloads.length - 1)]!;
      fetchHits += 1;
      return mockCompletion(content);
    }) as typeof fetch;
    try {
      const systemRepaired = await repairBuild({
        apiKey: "unused",
        prompt: systemBrief,
        html: "<p>vuoto</p>",
        error: "Tipo system perso.",
      });
      assert.ok(systemRepaired);
      assert.match(systemRepaired.html, /data-intent-type="system"/);
      assert.match(systemRepaired.html, /--body:ui-sans-serif,system-ui,-apple-system/);
      assert.doesNotMatch(systemRepaired.html, /--body:"Karla"/);
      const systemSrc = prepareSrcDoc(
        systemRepaired.html,
        systemRepaired.palette,
        "intent-system-repair",
        "app",
      );
      assert.match(systemSrc, /<span>Home<\/span>/);
      assert.match(systemSrc, /--body:ui-sans-serif,system-ui,-apple-system/);
      assert.doesNotMatch(systemSrc, /fonts\.googleapis\.com/);

      const serifRepaired = await repairBuild({
        apiKey: "unused",
        prompt: serifBrief,
        html: "<p>vuoto</p>",
        error: "Display serif perso.",
      });
      assert.ok(serifRepaired);
      assert.match(serifRepaired.html, /data-intent-type="serif"/);
      assert.match(serifRepaired.html, /--display:"Literata",ui-serif,Georgia/);
      assert.match(serifRepaired.html, /--body:"Literata",ui-serif,Georgia/);
      assert.doesNotMatch(serifRepaired.html, /--body:"Figtree"/);
      const serifSrc = prepareSrcDoc(
        serifRepaired.html,
        serifRepaired.palette,
        "intent-serif-repair",
        serifRepaired.kind,
      );
      assert.match(serifSrc, /--display:"Literata"/);
      assert.doesNotMatch(serifSrc, /font:400 16px\/1\.5 system-ui,sans-serif/);
      assert.equal(fetchHits, 2, "declared mock transport only");
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("enforce after mock repairBuild restores system CSS when the payload has no --body/--display", async () => {
    assert.equal(POLISH_REPAIR_LIVE_VERIFIED, false);
    const brief = "FORMATO: app telefono. kind=app. Font system-ui primario. Voglio una app stile iPhone.";
    const dropped = `<!DOCTYPE html><html lang="it"><head>
<style>body{font-family:Georgia} h1{font-family:Georgia}</style>
</head><body><h1>Lista</h1><main id="main"><p>voce</p></main></body></html>`;
    const complete = `<<<META>>>
{"name":"Lista","tagline":"intent","kind":"app","summary":"recorded","direction":"intent","palette":{"bg":"#efe6d4","surface":"#f7f1e4","fg":"#1c1712","muted":"#5c5348","accent":"#3d4a1f"}}
<<<HTML>>>
${dropped}
<<<END>>>`;
    const prev = globalThis.fetch;
    let fetchHits = 0;
    globalThis.fetch = (async () => {
      fetchHits += 1;
      return mockCompletion(complete);
    }) as typeof fetch;
    try {
      const repaired = await repairBuild({
        apiKey: "unused",
        prompt: brief,
        html: "<p>vuoto</p>",
        error: "Tipo system perso, CSS senza variabili.",
      });
      assert.equal(fetchHits, 1, "declared mock transport only");
      assert.ok(repaired);
      assert.match(repaired.html, /data-intent-type="system"/);
      assert.match(repaired.html, /font-family:ui-sans-serif,system-ui,-apple-system/);
      assert.doesNotMatch(repaired.html, /font-family:\s*Georgia/);
      assert.match(repaired.html, /--body:ui-sans-serif,system-ui,-apple-system/);
      const src = prepareSrcDoc(repaired.html, repaired.palette, "intent-novar", "app");
      assert.doesNotMatch(src, /font-family:\s*Georgia/);
      assert.match(src, /data-intent-type="system"/);
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("declared repairBuild mock rewrites font shorthand and qualified selectors (not a live controller-edit)", async () => {
    assert.equal(POLISH_REPAIR_LIVE_VERIFIED, false);
    const brief = "Font system-ui primario. Voglio una app stile iPhone.";
    const dropped = `<!DOCTYPE html><html lang="it"><head>
<style>body{font:16px Georgia}h1{font:32px Georgia}body.app,h1.title{font-family:Georgia}p.quote{font-family:Georgia}</style>
</head><body class="app"><h1 class="title">Lista</h1><p class="quote">Georgia, 1820</p><main id="main"><p>voce</p></main></body></html>`;
    const complete = `<<<META>>>
{"name":"Lista","tagline":"intent","kind":"app","summary":"recorded","direction":"intent","palette":{"bg":"#efe6d4","surface":"#f7f1e4","fg":"#1c1712","muted":"#5c5348","accent":"#3d4a1f"}}
<<<HTML>>>
${dropped}
<<<END>>>`;
    const prev = globalThis.fetch;
    let fetchHits = 0;
    globalThis.fetch = (async () => {
      fetchHits += 1;
      return mockCompletion(complete);
    }) as typeof fetch;
    try {
      const repaired = await repairBuild({
        apiKey: "unused",
        prompt: `${brief}\nAggiungi solo l'icona casa.`,
        html: "<p>vuoto</p>",
        error: "Tipo system perso, font shorthand Georgia.",
      });
      assert.equal(fetchHits, 1, "declared mock transport only");
      assert.ok(repaired);
      assert.match(repaired.html, /data-intent-type="system"/);
      assert.match(repaired.html, /font:16px ui-sans-serif,system-ui,-apple-system/);
      assert.match(repaired.html, /font:32px ui-sans-serif,system-ui,-apple-system/);
      assert.match(repaired.html, /body\.app,h1\.title\{font-family:ui-sans-serif,system-ui,-apple-system/);
      assert.doesNotMatch(repaired.html, /body\{font:16px Georgia/);
      assert.match(repaired.html, /p\.quote\{font-family:Georgia/);
      assert.match(repaired.html, />Georgia, 1820</);
      const src = prepareSrcDoc(repaired.html, repaired.palette, "intent-shorthand", "app");
      assert.doesNotMatch(src, /body\{font:16px Georgia/);
      assert.match(src, /data-intent-type="system"/);
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("declared repairBuild mock keeps weight/size/line-height on font shorthand (not a live controller-edit)", async () => {
    assert.equal(POLISH_REPAIR_LIVE_VERIFIED, false);
    const brief = "Font system-ui primario. Voglio una app stile iPhone.";
    const dropped = `<!DOCTYPE html><html lang="it"><head>
<style>
h1.w{font:700 22px/1.2 Georgia}
h1.i{font:italic 600 1.5rem/1.3 Georgia}
h1.b{font:700 22px/ 1.2 Georgia}
button.cta{font:700 14px/1 Georgia}
p.quote{font-family:Georgia}
</style>
</head><body><h1 class="w">Peso</h1><h1 class="i">Corsivo</h1><button class="cta">Ok</button><p class="quote">Georgia, 1820</p><main id="main"><p>voce</p></main></body></html>`;
    const complete = `<<<META>>>
{"name":"Lista","tagline":"intent","kind":"app","summary":"recorded","direction":"intent","palette":{"bg":"#efe6d4","surface":"#f7f1e4","fg":"#1c1712","muted":"#5c5348","accent":"#3d4a1f"}}
<<<HTML>>>
${dropped}
<<<END>>>`;
    const prev = globalThis.fetch;
    let fetchHits = 0;
    globalThis.fetch = (async () => {
      fetchHits += 1;
      return mockCompletion(complete);
    }) as typeof fetch;
    try {
      const repaired = await repairBuild({
        apiKey: "unused",
        prompt: brief,
        html: "<p>vuoto</p>",
        error: "Tipo system perso, font:700 22px/1.2 Georgia.",
      });
      assert.equal(fetchHits, 1, "declared mock transport only");
      assert.ok(repaired);
      assert.match(repaired.html, /font:700 22px\/1\.2 ui-sans-serif,system-ui,-apple-system/);
      assert.match(repaired.html, /font:italic 600 1\.5rem\/1\.3 ui-sans-serif,system-ui,-apple-system/);
      assert.match(repaired.html, /font:700 22px\/ 1\.2 ui-sans-serif,system-ui,-apple-system/);
      assert.doesNotMatch(repaired.html, /h1\.b\{font:700 22px\/ ui-sans-serif/);
      assert.doesNotMatch(repaired.html, /h1\.w\{font:700 ui-sans-serif/);
      assert.doesNotMatch(repaired.html, /h1\.i\{font:italic 600 ui-sans-serif/);
      assert.match(repaired.html, /button\.cta\{font:700 14px\/1 Georgia/);
      assert.match(repaired.html, /p\.quote\{font-family:Georgia/);
      const src = prepareSrcDoc(repaired.html, repaired.palette, "intent-shorthand-weight", "app");
      assert.match(src, /font:700 22px\/1\.2 ui-sans-serif,system-ui,-apple-system/);
      assert.doesNotMatch(src, /h1\.w\{font:700 ui-sans-serif/);
    } finally {
      globalThis.fetch = prev;
    }
  });
});
