import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { type Page } from "playwright";
import { isolatedPage, isBlockedPublicNetworkError, launchChromium } from "../projects/playwright-harness.ts";
import { prepareSrcDoc } from "../projects/color-scheme.ts";
import { composeProduct } from "./compose-product.ts";
import { repairBuild } from "./repair.ts";
import { formatPrefix } from "../projects/infer.ts";
import {
  GRAPHIC_INTENT_PARENT_SHA,
  INTENT_IPHONE_IT_PROMPT,
  INTENT_SERIF_PROMPT,
  INTENT_SYSTEM_PROMPT,
  enforceGraphicIntent,
} from "../projects/graphic-intent.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(here, "fixtures/graphic/intent");
const BEFORE = join(SHOTS, "before");
const AFTER = "/workspace/screenshots/fase3-graphic/intent-after";
const VIEWPORTS = [
  ["D", { width: 1280, height: 800 }],
  ["T", { width: 768, height: 1024 }],
  ["M", { width: 390, height: 844 }],
] as const;
const NARROW = { width: 320, height: 568 } as const;

const PERSIST_HOST = `<!DOCTYPE html><html><head><style>html,body,#f{margin:0;width:100%;height:100%;border:0;display:block;background:transparent}</style></head><body>
<iframe id="f"></iframe>
<script>
window.__db = {};
window.addEventListener("message", function(e){
  var m=e.data;
  if(!m || m.t!=="fenix-db" || !m.id) return;
  if(m.op==="save") window.__db[m.col]=m.data;
  var value=m.op==="load" ? (window.__db[m.col] || null) : {ok:true,v:m.data,durable:Array.isArray(m.data&&m.data.items)?m.data.items.length:0};
  e.source.postMessage({t:"fenix-db",id:m.id,v:value},"*");
});
</script></body></html>`;

const BRIEFS = [
  { id: "system", brief: `${formatPrefix("app")}${INTENT_SYSTEM_PROMPT}` },
  { id: "serif", brief: `${formatPrefix("app")}${INTENT_SERIF_PROMPT}` },
] as const;

function mockCompletion(content: string): Response {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as Response;
}

function wrapPayload(
  name: string,
  html: string,
  kind: string,
  palette?: { bg: string; surface: string; fg: string; muted: string; accent: string },
): string {
  const p = palette || {
    bg: "#eceff3",
    surface: "#ffffff",
    fg: "#1b1f24",
    muted: "#5a6570",
    accent: "#125e57",
  };
  return `<<<META>>>
{"name":"${name}","tagline":"intent","kind":"${kind}","summary":"recorded","direction":"intent","palette":${JSON.stringify(p)}}
<<<HTML>>>
${html}
<<<END>>>`;
}

/** Simulate an LLM that dropped CSS vars and painted Georgia on body/h1. */
function dropTypeToGeorgia(html: string): string {
  let next = html
    .replace(/--display\s*:[^;}]+/g, "")
    .replace(/--body\s*:[^;}]+/g, "")
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, "");
  if (/<style\b/i.test(next)) {
    next = next.replace(/<style\b[^>]*>/i, (open) => `${open}body{font-family:Georgia}h1,h2,.brand{font-family:Georgia}`);
  } else {
    next = next.replace(/<head\b[^>]*>/i, (open) => `${open}<style>body{font-family:Georgia}h1{font-family:Georgia}</style>`);
  }
  return next;
}

async function repairThroughDeclaredMock(
  brief: string,
  html: string,
  kind: string,
  name: string,
  palette?: { bg: string; surface: string; fg: string; muted: string; accent: string },
) {
  const payload = wrapPayload(name, dropTypeToGeorgia(html), kind, palette);
  const prev = globalThis.fetch;
  let fetchHits = 0;
  globalThis.fetch = (async () => {
    fetchHits += 1;
    return mockCompletion(payload);
  }) as typeof fetch;
  try {
    const repaired = await repairBuild({
      apiKey: "unused",
      prompt: `${brief}\nAggiungi solo l'icona casa.`,
      html: "<p>vuoto</p>",
      error: "Tipo grafico perso. CSS senza --body/--display.",
    });
    assert.equal(fetchHits, 1, "declared mock transport only; not a live controller-edit");
    assert.ok(repaired, "repairBuild must parse the declared mock");
    return repaired;
  } finally {
    globalThis.fetch = prev;
  }
}

async function paintedNav(frame: ReturnType<Page["frameLocator"]>) {
  return frame.locator("html").evaluate(() => {
    const lum = (r: number, g: number, b: number) => {
      const to = (n: number) => {
        const x = n / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * to(r) + 0.7152 * to(g) + 0.0722 * to(b);
    };
    const parse = (c: string) => {
      const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?/);
      if (!m) return null;
      return { r: +m[1]!, g: +m[2]!, b: +m[3]!, a: m[4] == null ? 1 : +m[4] };
    };
    const solidBehind = (el: Element | null): { r: number; g: number; b: number } => {
      let node: Element | null = el;
      const stack: { r: number; g: number; b: number; a: number }[] = [];
      while (node) {
        const raw = getComputedStyle(node).backgroundColor;
        const p = parse(raw);
        if (p && p.a > 0.01) stack.push(p);
        if (p && p.a >= 0.99) break;
        node = node.parentElement;
      }
      let acc = { r: 255, g: 255, b: 255 };
      for (let i = stack.length - 1; i >= 0; i--) {
        const s = stack[i]!;
        acc = {
          r: Math.round(s.r * s.a + acc.r * (1 - s.a)),
          g: Math.round(s.g * s.a + acc.g * (1 - s.a)),
          b: Math.round(s.b * s.a + acc.b * (1 - s.a)),
        };
      }
      return acc;
    };
    const ratio = (color: string, bg: { r: number; g: number; b: number }) => {
      const fg = parse(color);
      if (!fg) return 0;
      const ink = {
        r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
        g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
        b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
      };
      const l1 = lum(ink.r, ink.g, ink.b);
      const l2 = lum(bg.r, bg.g, bg.b);
      const hi = Math.max(l1, l2);
      const lo = Math.min(l1, l2);
      return (hi + 0.05) / (lo + 0.05);
    };
    return [...document.querySelectorAll("nav button[data-view]")].map((b) => {
      const cs = getComputedStyle(b);
      const span = b.querySelector("span");
      const svg = b.querySelector("svg");
      const bg = solidBehind(b);
      const br = b.getBoundingClientRect();
      const sr = span ? span.getBoundingClientRect() : { width: 0, height: 0 };
      const ir = svg ? svg.getBoundingClientRect() : { width: 0, height: 0 };
      return {
        label: ((span && span.textContent) || "").trim(),
        on: b.classList.contains("on"),
        contrast: ratio(cs.color, bg),
        bw: br.width,
        bh: br.height,
        sw: sr.width,
        sh: sr.height,
        iw: ir.width,
        ih: ir.height,
      };
    });
  });
}

async function restFrame(page: Page) {
  const frame = page.frameLocator("#f");
  await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
  await frame.locator("html:not([data-fenix-persist='busy'])").waitFor({ timeout: 8000 });
  if (await frame.locator("#load").count()) {
    await frame.locator("#load").waitFor({ state: "hidden", timeout: 8000 });
  }
  if (await frame.locator("#toast").count()) {
    await frame.locator("#toast").waitFor({ state: "hidden", timeout: 4000 });
  }
  if (await frame.locator("#err").count()) {
    assert.equal(
      await frame.locator("#err").isVisible(),
      false,
      "visible #err after settle — real error, not masked",
    );
  }
  await page.locator("#f").evaluate((el) => {
    const doc = (el as HTMLIFrameElement).contentDocument;
    if (!doc) return;
    const main = doc.querySelector("main");
    if (main) main.scrollTop = 0;
    doc.documentElement.scrollTop = 0;
    doc.body.scrollTop = 0;
    doc.defaultView?.scrollTo(0, 0);
  });
}

async function paneBody(frame: ReturnType<Page["frameLocator"]>) {
  return frame.locator("html").evaluate(() => {
    const root = document.getElementById("root");
    const pane = document.querySelector("[data-fenix-pane]");
    return {
      view: root?.getAttribute("data-fenix-view") || "",
      pane: pane?.getAttribute("data-fenix-pane") || "",
      html: (root?.innerHTML || "").replace(/\s+/g, " ").trim(),
      text: (root?.innerText || "").replace(/\s+/g, " ").trim(),
      hasForm: Boolean(document.querySelector("#fnew")),
      hasList: Boolean(document.querySelector(".list-pane")),
      hasHome: Boolean(document.querySelector(".home-overview")),
      hasPersona: Boolean(document.querySelector(".persona-pane")),
      hasWipe: Boolean(document.querySelector("[data-fenix-wipe],[data-act^='wipe']")),
    };
  });
}

function assertPairwiseDistinct(
  bodies: Awaited<ReturnType<typeof paneBody>>[],
  label: string,
) {
  assert.equal(bodies.length, 4, `${label} body count`);
  const panes = bodies.map((b) => b.pane);
  assert.equal(new Set(panes).size, 4, `${label} pane ids ${panes.join(",")}`);
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      assert.notEqual(
        bodies[i]!.html,
        bodies[j]!.html,
        `${label} ${bodies[i]!.pane} html equals ${bodies[j]!.pane}`,
      );
      assert.notEqual(
        bodies[i]!.text.slice(0, 180),
        bodies[j]!.text.slice(0, 180),
        `${label} ${bodies[i]!.pane} text equals ${bodies[j]!.pane}`,
      );
    }
  }
  assert.ok(bodies.some((b) => b.hasHome && !b.hasForm && !b.hasList), `${label} home`);
  assert.ok(bodies.some((b) => b.hasForm && !b.hasHome), `${label} form`);
  assert.ok(bodies.some((b) => b.hasList && !b.hasForm), `${label} elenco`);
  assert.ok(bodies.some((b) => b.hasPersona && b.hasWipe !== undefined), `${label} persona`);
}

async function assertClearOfNav(frame: ReturnType<Page["frameLocator"]>, label: string) {
  const geom = await frame.locator("html").evaluate(() => {
    const main = document.querySelector("main") as HTMLElement | null;
    const nav = document.querySelector("nav.tabs") as HTMLElement | null;
    if (!main || !nav) return { worst: 0, pad: "0", navH: 0, skip: true };
    const mainBox = main.getBoundingClientRect();
    const navBox = nav.getBoundingClientRect();
    if (navBox.top + 8 < mainBox.top) {
      return { worst: 0, pad: getComputedStyle(main).paddingBottom, navH: navBox.height, skip: true };
    }
    main.scrollTop = main.scrollHeight;
    const navTop = nav.getBoundingClientRect().top;
    const nodes = [...main.querySelectorAll("h2, .card, li, .btn, .home-hero, .wipe-box, .state-empty")]
      .map((n) => n.getBoundingClientRect())
      .filter((b) => b.height >= 2 && b.width >= 2);
    const last = nodes.at(-1);
    const worst = last && last.bottom > navTop + 1.5 ? last.bottom - navTop : 0;
    return {
      worst,
      pad: getComputedStyle(main).paddingBottom,
      navH: nav.getBoundingClientRect().height,
      skip: false,
    };
  });
  if (geom.skip) return;
  assert.ok(
    geom.worst <= 2,
    `${label} content under nav ${geom.worst}px pad=${geom.pad} navH=${geom.navH}`,
  );
}

async function waitHeading(page: Page, title: string, timeout = 8000) {
  await page.waitForFunction(
    (t) => {
      const el = document.querySelector("#f") as HTMLIFrameElement | null;
      const doc = el && el.contentDocument;
      if (!doc) return false;
      return [...doc.querySelectorAll("h2")].some((node) => (node.textContent || "").trim() === t);
    },
    title,
    { timeout },
  );
}

async function headingCount(page: Page, title: string): Promise<number> {
  return page.locator("#f").evaluate((el, t) => {
    const doc = (el as HTMLIFrameElement).contentDocument;
    if (!doc) return 0;
    return [...doc.querySelectorAll("h2")].filter((node) => (node.textContent || "").trim() === t).length;
  }, title);
}

async function clickActOnHeading(frame: ReturnType<Page["frameLocator"]>, title: string, act: "edit" | "del") {
  const cards = frame.locator("article[data-id], div.card[data-id], li.card[data-id]");
  const n = await cards.count();
  for (let i = 0; i < n; i++) {
    const text = await cards
      .nth(i)
      .locator("h2")
      .first()
      .evaluate((el) => (el.textContent || "").trim());
    if (text !== title) continue;
    await cards.nth(i).locator(`[data-act="${act}"]`).click();
    return;
  }
  assert.equal(true, false, `${act} control for ${title}`);
}

async function crudRoundtrip(
  page: Page,
  frame: ReturnType<Page["frameLocator"]>,
  src: string,
  formView: string,
  listView: string,
  label: string,
) {
  const load = () =>
    page.locator("#f").evaluate((el, srcDoc: string) => {
      (el as HTMLIFrameElement).srcdoc = srcDoc;
    }, src);
  await frame.locator(`nav button[data-view="${formView}"]`).click();
  await frame.locator("#n").waitFor({ timeout: 4000 });
  await frame.locator("#n").fill(label);
  if (await frame.locator("#k").count()) await frame.locator("#k").fill("dettaglio");
  if (await frame.locator("#note").count()) await frame.locator("#note").fill("nota");
  if (await frame.locator("#ora").count()) await frame.locator("#ora").fill("09:30");
  if (await frame.locator("#data").count()) {
    const day = await frame.locator("html").evaluate(() => new Date().toISOString().slice(0, 10));
    await frame.locator("#data").fill(day);
  }
  if (await frame.locator("#luogo").count()) await frame.locator("#luogo").fill("Sala");
  if (await frame.locator("#cliente").count()) await frame.locator("#cliente").fill("Noa");
  await frame.locator('#fnew [data-act="save"]').click();
  await frame.locator("html:not([data-fenix-persist='busy'])").waitFor({ timeout: 8000 });
  await waitHeading(page, label);
  await frame.locator(`nav button[data-view="${listView}"]`).click();
  await waitHeading(page, label);
  const updated = `${label} ok`;
  await clickActOnHeading(frame, label, "edit");
  await frame.locator("#n").waitFor({ timeout: 4000 });
  await frame.locator("#n").fill(updated);
  await frame.locator('#fnew [data-act="save"]').click();
  await frame.locator("html:not([data-fenix-persist='busy'])").waitFor({ timeout: 8000 });
  await load();
  await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
  await frame.locator(`nav button[data-view="${listView}"]`).click();
  await waitHeading(page, updated);
  await clickActOnHeading(frame, updated, "del");
  await frame.locator("html:not([data-fenix-persist='busy'])").waitFor({ timeout: 8000 });
  await load();
  await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
  await frame.locator(`nav button[data-view="${listView}"]`).click();
  assert.equal(await headingCount(page, updated), 0, `${label} delete+reload`);
}

describe("intent preservation D/T/M after compose+repair path+prepareSrcDoc", () => {
  it("keeps system/iPhone-like and serif direction on computed styles, CRUD, reload, console", async () => {
    assert.equal(GRAPHIC_INTENT_PARENT_SHA, "76414c75ce4dc1b2f66343fc0ed1160be0c1b45b");
    assert.equal(readFileSync(join(BEFORE, "parent.txt"), "utf8").trim(), GRAPHIC_INTENT_PARENT_SHA);
    const before = BRIEFS.flatMap((row) =>
      VIEWPORTS.map(([vp]) => {
        const name = `${row.id}-${vp}.png`;
        const buf = readFileSync(join(BEFORE, name));
        return { name, sha256: createHash("sha256").update(buf).digest("hex"), bytes: buf.length };
      }),
    );
    assert.equal(before.length, 6);
    const browser = await launchChromium();
    const files: { name: string; sha256: string }[] = [];
    try {
      for (const row of BRIEFS) {
        const composed = composeProduct(row.brief);
        const repaired = await repairThroughDeclaredMock(
          row.brief,
          composed.html,
          composed.grammar.kind,
          row.id === "system" ? "Lista" : "Atelier",
          composed.tokens.palette,
        );
        const src = prepareSrcDoc(
          repaired.html,
          composed.tokens.palette,
          `intent-${row.id}`,
          repaired.kind,
        );
        assert.match(src, new RegExp(`data-intent-type="${row.id === "system" ? "system" : "serif"}"`));
        assert.doesNotMatch(src, /font-family:\s*Georgia/);
        for (const [vp, viewport] of VIEWPORTS) {
          const page = await isolatedPage(browser, { viewport });
          const errors: string[] = [];
          page.on("pageerror", (err) => {
            if (!isBlockedPublicNetworkError(String(err))) errors.push(String(err));
          });
          page.on("console", (msg) => {
            if (msg.type() === "error" && !isBlockedPublicNetworkError(msg.text())) errors.push(msg.text());
          });
          try {
            await page.setContent(PERSIST_HOST, { waitUntil: "domcontentloaded", timeout: 15000 });
            await page.locator("#f").evaluate((el, srcDoc: string) => {
              (el as HTMLIFrameElement).srcdoc = srcDoc;
            }, src);
            const frame = page.frameLocator("#f");
            await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
            await restFrame(page);
            const painted = await frame.locator("html").evaluate(() => {
              const root = getComputedStyle(document.documentElement);
              const body = getComputedStyle(document.body);
              const brand = document.querySelector(".brand, header h1, h1, h2");
              const heading = brand ? getComputedStyle(brand) : body;
              return {
                bodyVar: root.getPropertyValue("--body"),
                displayVar: root.getPropertyValue("--display"),
                bodyFamily: body.fontFamily,
                headingFamily: heading.fontFamily,
                intentType: document.documentElement.getAttribute("data-intent-type"),
                intentChrome: document.documentElement.getAttribute("data-intent-chrome"),
                tabs: [...document.querySelectorAll("nav button[data-view] span")].map((s) =>
                  (s.textContent || "").trim(),
                ),
                views: [...document.querySelectorAll("nav button[data-view]")].map(
                  (b) => b.getAttribute("data-view") || "",
                ),
              };
            });
            if (row.id === "system") {
              assert.equal(painted.intentType, "system");
              assert.equal(painted.intentChrome, "semantic");
              assert.match(painted.bodyVar, /system-ui/);
              assert.match(painted.displayVar, /system-ui/);
              assert.doesNotMatch(painted.bodyVar, /Literata|Karla|Figtree|Newsreader/);
              assert.doesNotMatch(painted.bodyFamily, /Literata|Karla|Figtree|Newsreader|Georgia/i);
              assert.ok(painted.tabs.includes("Home"), painted.tabs.join(","));
              assert.ok(painted.tabs.includes("Aggiungi"), painted.tabs.join(","));
              assert.ok(painted.tabs.includes("Persona"), painted.tabs.join(","));
            } else {
              assert.equal(painted.intentType, "serif");
              assert.match(painted.displayVar, /Literata/);
              assert.match(painted.bodyVar, /Literata/);
              assert.doesNotMatch(painted.bodyVar, /Figtree|Karla|Inter/);
              assert.ok(
                /literata|georgia|times|ui-serif/i.test(painted.headingFamily),
                painted.headingFamily,
              );
              assert.doesNotMatch(painted.headingFamily, /Figtree|Karla|Inter/i);
            }
            const overflow = await frame.locator("html").evaluate(
              () => document.documentElement.scrollWidth - window.innerWidth,
            );
            assert.ok(overflow <= 8, `${row.id}/${vp} overflow ${overflow}`);
            const nav0 = await paintedNav(frame);
            assert.ok(nav0.length >= 3, `${row.id}/${vp} tabs ${nav0.length}`);
            for (const tab of nav0) {
              assert.ok(tab.bw >= 44 && tab.bh >= 24, `${row.id}/${vp} ${tab.label} hit ${tab.bw}x${tab.bh}`);
              assert.ok(tab.sw >= 8 && tab.sh >= 6, `${row.id}/${vp} ${tab.label} label ${tab.sw}x${tab.sh}`);
              assert.ok(tab.iw >= 8 && tab.ih >= 8, `${row.id}/${vp} ${tab.label} icon ${tab.iw}x${tab.ih}`);
              assert.ok(tab.contrast >= 4.5, `${row.id}/${vp} ${tab.label}${tab.on ? " ON" : ""} contrast ${tab.contrast}`);
              if (row.id === "system") {
                assert.ok(tab.iw >= 26 && tab.ih >= 26, `${row.id}/${vp} ${tab.label} icon ${tab.iw}x${tab.ih}`);
                assert.ok(tab.bh >= 44, `${row.id}/${vp} ${tab.label} tap ${tab.bh}`);
              }
            }
            assert.ok(nav0.some((t) => t.on), `${row.id}/${vp} missing active tab`);
            const viewSigs: string[] = [];
            const viewBodies: Awaited<ReturnType<typeof paneBody>>[] = [];
            for (const view of painted.views) {
              await frame.locator(`nav button[data-view="${view}"]`).click();
              const afterClick = await paintedNav(frame);
              const active = afterClick.find((t) => t.on);
              assert.ok(active, `${row.id}/${vp} click ${view}`);
              assert.ok(active!.contrast >= 4.5, `${row.id}/${vp} click ${view} ON ${active!.contrast}`);
              assert.ok(active!.sw >= 8 && active!.iw >= 8, `${row.id}/${vp} click ${view} clipped`);
              if (row.id === "system") {
                await restFrame(page);
                const body = await paneBody(frame);
                viewBodies.push(body);
                const sig = `${body.view}|${body.pane}|${body.text.slice(0, 240)}`;
                viewSigs.push(sig);
                mkdirSync(SHOTS, { recursive: true });
                const paneShot = join(SHOTS, `${row.id}-${vp}-${body.pane || view}.png`);
                await page.locator("#f").screenshot({ path: paneShot });
                try {
                  mkdirSync(AFTER, { recursive: true });
                  await page.locator("#f").screenshot({ path: join(AFTER, `${row.id}-${vp}-${body.pane || view}.png`) });
                } catch {
                  /* CI without scorecard dir */
                }
                if (vp === "M" || vp === "D") await assertClearOfNav(frame, `${row.id}/${vp}/${body.pane}`);
              }
            }
            if (row.id === "system") {
              assert.equal(painted.views.length, 4, `${row.id}/${vp} tab count ${painted.views.join(",")}`);
              assert.equal(new Set(viewSigs).size, 4, `${row.id}/${vp} views collide ${viewSigs.join(" || ")}`);
              assertPairwiseDistinct(viewBodies, `${row.id}/${vp}`);
            }
            await frame.locator(`nav button[data-view="${painted.views[0]}"]`).click();
            if (row.id === "system") {
              const bodyText = await frame.locator("html").evaluate(() => document.body.innerText);
              assert.doesNotMatch(bodyText, /paper\s*·|glacier|Literata|Karla|anti-clone|system-ui/);
              assert.doesNotMatch(bodyText, /Lista in tasca uno|Lista in tasca due|Lista in tasca tre/);
              assert.match(bodyText, /Niente in lista|Aggiungi/);
              const sheet = await frame.locator("html").evaluate(() => {
                const h1 = [...document.querySelectorAll("header h1")].map((el) => (el.textContent || "").trim());
                const kicker = (document.querySelector("header .kicker")?.textContent || "").trim();
                const cta = document.querySelector(".home-first .btn") as HTMLElement | null;
                const box = cta?.getBoundingClientRect();
                return {
                  h1,
                  kicker,
                  ctaW: box?.width || 0,
                  ctaH: box?.height || 0,
                  bg: getComputedStyle(document.body).backgroundColor,
                };
              });
              assert.equal(sheet.h1.length, 1, `${row.id}/${vp} duplicate title ${sheet.h1.join("|")}`);
              assert.notEqual(sheet.kicker, "Lista", `${row.id}/${vp} kicker Lista`);
              assert.ok(sheet.ctaW >= 200, `${row.id}/${vp} CTA width ${sheet.ctaW}`);
              assert.ok(sheet.ctaH >= 44, `${row.id}/${vp} CTA height ${sheet.ctaH}`);
              assert.doesNotMatch(sheet.bg, /rgb\(\s*2(3[2-9]|4\d|5\d),\s*2(2\d|3\d),\s*1\d{2}\)/);
            }
            mkdirSync(SHOTS, { recursive: true });
            const dest = join(SHOTS, `${row.id}-${vp}.png`);
            await page.locator("#f").screenshot({ path: dest });
            try {
              mkdirSync(AFTER, { recursive: true });
              await page.locator("#f").screenshot({ path: join(AFTER, `${row.id}-${vp}.png`) });
            } catch {
              /* CI without scorecard dir */
            }
            const buf = readFileSync(dest);
            assert.ok(statSync(dest).size > 4000, `${row.id}-${vp} shot too small`);
            files.push({ name: `${row.id}-${vp}.png`, sha256: createHash("sha256").update(buf).digest("hex") });

            const formView = painted.views[1];
            const listView = painted.views[2];
            assert.ok(formView && listView, `${row.id} tabs`);
            if (row.id === "system") {
              await frame.locator(`nav button[data-view="${formView}"]`).click();
              await frame.locator("#n").waitFor({ timeout: 4000 });
              await frame.locator("#n").fill("Voce vera");
              if (await frame.locator("#k").count()) await frame.locator("#k").fill("dettaglio");
              if (await frame.locator("#note").count()) await frame.locator("#note").fill("nota utile");
              await frame.locator('#fnew [data-act="save"]').click();
              await restFrame(page);
              await frame.locator(`nav button[data-view="${painted.views[0]}"]`).click();
              await restFrame(page);
              const homePaint = await frame.locator("html").evaluate(() => {
                const root = document.getElementById("root");
                const count = document.querySelector(".home-count") as HTMLElement | null;
                return {
                  pane: document.querySelector("[data-fenix-pane]")?.getAttribute("data-fenix-pane") || "",
                  lists: document.querySelectorAll(".pocket-list").length,
                  recent: [...document.querySelectorAll(".home-recent h2")].map((el) => (el.textContent || "").trim()),
                  count: Number(count?.getAttribute("data-count") || count?.textContent || "0"),
                  text: (root?.innerText || "").replace(/\s+/g, " "),
                };
              });
              assert.equal(homePaint.pane, "home", `${row.id}/${vp} home pane ${homePaint.pane}`);
              assert.equal(homePaint.lists, 0, `${row.id}/${vp} home must not be the full list`);
              assert.ok(homePaint.count >= 1, `${row.id}/${vp} home count ${homePaint.count}`);
              assert.ok(homePaint.recent.includes("Voce vera"), homePaint.recent.join(","));
              assert.doesNotMatch(homePaint.text, /Modifica|Archivia/);
              const popShot = join(SHOTS, `${row.id}-${vp}-populated.png`);
              await page.locator("#f").screenshot({ path: popShot });
              try {
                mkdirSync(AFTER, { recursive: true });
                await page.locator("#f").screenshot({ path: join(AFTER, `${row.id}-${vp}-populated.png`) });
              } catch {
                /* CI without scorecard dir */
              }
              await frame.locator(`nav button[data-view="${listView}"]`).click();
              await restFrame(page);
              const populated = await frame.locator("html").evaluate(() => {
                const ul = document.querySelector(".pocket-list");
                const cs = ul ? getComputedStyle(ul) : null;
                const li = document.querySelector(".pocket-list > li") as HTMLElement | null;
                const box = li?.getBoundingClientRect();
                const pane = document.querySelector("[data-fenix-pane]");
                return {
                  pane: pane?.getAttribute("data-fenix-pane") || "",
                  n: document.querySelectorAll(".pocket-list [data-id]").length,
                  title: [...document.querySelectorAll(".pocket-list h2")].map((el) => (el.textContent || "").trim()),
                  notes: [...document.querySelectorAll(".pocket-list .notes")].map((el) => (el.textContent || "").trim()),
                  acts: document.querySelectorAll('.pocket-list [data-act="edit"], .pocket-list [data-act="del"]').length,
                  list: cs?.listStyleType || "",
                  pad: cs ? Number.parseFloat(cs.paddingLeft) : 99,
                  left: box?.left || 0,
                  right: box?.right || 0,
                  vw: window.innerWidth,
                };
              });
              assert.equal(populated.pane, "elenco", `${row.id}/${vp} elenco pane ${populated.pane}`);
              assert.ok(populated.n >= 1, `${row.id}/${vp} elenco empty`);
              assert.ok(populated.title.includes("Voce vera"), populated.title.join(","));
              assert.ok(populated.acts >= 2, `${row.id}/${vp} elenco actions ${populated.acts}`);
              assert.equal(populated.list, "none", `${row.id}/${vp} list-style ${populated.list}`);
              assert.ok(populated.pad < 1, `${row.id}/${vp} ul pad ${populated.pad}`);
              assert.ok(populated.left >= 8, `${row.id}/${vp} card clipped left ${populated.left}`);
              assert.ok(populated.right <= populated.vw - 8, `${row.id}/${vp} card clipped right ${populated.right}/${populated.vw}`);
              for (const note of populated.notes) {
                assert.doesNotMatch(note, /nuovo|^—$|—\s*·/);
              }
              await assertClearOfNav(frame, `${row.id}/${vp}/elenco-pop`);
              const elencoShot = join(SHOTS, `${row.id}-${vp}-elenco-populated.png`);
              await page.locator("#f").screenshot({ path: elencoShot });
              try {
                mkdirSync(AFTER, { recursive: true });
                await page.locator("#f").screenshot({ path: join(AFTER, `${row.id}-${vp}-elenco-populated.png`) });
              } catch {
                /* CI without scorecard dir */
              }
              if (vp === "M") {
                const elencoM = join(SHOTS, `${row.id}-M-elenco.png`);
                await page.locator("#f").screenshot({ path: elencoM });
                try {
                  mkdirSync(AFTER, { recursive: true });
                  await page.locator("#f").screenshot({ path: join(AFTER, `${row.id}-M-elenco.png`) });
                } catch {
                  /* CI without scorecard dir */
                }
              }
              const personaView = painted.views[3];
              assert.ok(personaView, `${row.id}/${vp} persona tab`);
              await frame.locator(`nav button[data-view="${personaView}"]`).click();
              await restFrame(page);
              const personaPop = await paneBody(frame);
              assert.equal(personaPop.pane, "persona", `${row.id}/${vp} persona pane`);
              assert.ok(personaPop.hasPersona, `${row.id}/${vp} persona body`);
              assert.match(personaPop.text, /Storage locale/);
              assert.match(personaPop.text, /Nessun profilo/);
              assert.doesNotMatch(personaPop.text, /#fnew|Nome\nDettaglio/);
              await page.locator("#f").screenshot({ path: join(SHOTS, `${row.id}-${vp}-persona-populated.png`) });
              try {
                mkdirSync(AFTER, { recursive: true });
                await page.locator("#f").screenshot({
                  path: join(AFTER, `${row.id}-${vp}-persona-populated.png`),
                });
              } catch {
                /* CI without scorecard dir */
              }
              await frame.locator('[data-act="wipe-ask"]').click();
              await restFrame(page);
              assert.equal(await frame.locator('[data-act="wipe-confirm"]').count(), 1, `${row.id}/${vp} wipe confirm`);
              await frame.locator('[data-act="wipe-confirm"]').click();
              await frame.locator("html:not([data-fenix-persist='busy'])").waitFor({ timeout: 8000 });
              await restFrame(page);
              await page.locator("#f").evaluate((el, srcDoc: string) => {
                (el as HTMLIFrameElement).srcdoc = srcDoc;
              }, src);
              await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
              await restFrame(page);
              await frame.locator(`nav button[data-view="${personaView}"]`).click();
              await restFrame(page);
              const personaEmpty = await frame.locator("html").evaluate(() => ({
                pane: document.querySelector("[data-fenix-pane]")?.getAttribute("data-fenix-pane") || "",
                count: Number(document.querySelector(".home-count")?.getAttribute("data-count") || "99"),
                items: document.querySelectorAll("[data-id]").length,
                confirm: document.querySelectorAll('[data-act="wipe-confirm"]').length,
                text: (document.getElementById("root")?.innerText || "").replace(/\s+/g, " "),
              }));
              assert.equal(personaEmpty.pane, "persona");
              assert.equal(personaEmpty.count, 0, `${row.id}/${vp} persona after wipe ${personaEmpty.count}`);
              assert.equal(personaEmpty.items, 0, `${row.id}/${vp} leftover items`);
              assert.equal(personaEmpty.confirm, 0);
              assert.match(personaEmpty.text, /Quando salvi una voce|conteggio/);
              await frame.locator(`nav button[data-view="${painted.views[0]}"]`).click();
              await restFrame(page);
              const homeEmpty = await frame.locator("html").evaluate(
                () => document.querySelectorAll(".home-first[data-state='empty']").length,
              );
              assert.ok(homeEmpty >= 1, `${row.id}/${vp} home not empty after wipe`);
            }
            await crudRoundtrip(page, frame, src, formView, listView, `Intent ${row.id} ${vp}`);
            if (vp === "M") {
              await restFrame(page);
              const afterCrud = join(SHOTS, `${row.id}-M-after-crud.png`);
              await page.locator("#f").screenshot({ path: afterCrud });
              try {
                mkdirSync(AFTER, { recursive: true });
                await page.locator("#f").screenshot({ path: join(AFTER, `${row.id}-M-after-crud.png`) });
              } catch {
                /* CI without scorecard dir */
              }
              assert.ok(statSync(afterCrud).size > 4000, `${row.id}-M-after-crud shot too small`);
            }
            assert.equal(errors.length, 0, `${row.id}/${vp} ${errors.join(" | ")}`);
          } finally {
            await page.close();
          }
        }
        {
          const page = await isolatedPage(browser, { viewport: NARROW });
          const errors: string[] = [];
          page.on("pageerror", (err) => {
            if (!isBlockedPublicNetworkError(String(err))) errors.push(String(err));
          });
          try {
            await page.setContent(PERSIST_HOST, { waitUntil: "domcontentloaded", timeout: 15000 });
            await page.locator("#f").evaluate((el, srcDoc: string) => {
              (el as HTMLIFrameElement).srcdoc = srcDoc;
            }, src);
            const frame = page.frameLocator("#f");
            await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
            await restFrame(page);
            const overflow = await frame.locator("html").evaluate(
              () => document.documentElement.scrollWidth - window.innerWidth,
            );
            assert.ok(overflow <= 8, `${row.id}/320 overflow ${overflow}`);
            const navN = await paintedNav(frame);
            for (const tab of navN) {
              assert.ok(tab.sw >= 8 && tab.iw >= 8, `${row.id}/320 ${tab.label} clipped ${tab.sw}x${tab.iw}`);
              assert.ok(tab.contrast >= 4.5, `${row.id}/320 ${tab.label} contrast ${tab.contrast}`);
            }
            const views = await frame.locator("html").evaluate(() =>
              [...document.querySelectorAll("nav button[data-view]")].map((b) => b.getAttribute("data-view") || ""),
            );
            assert.ok(views[1] && views[2], `${row.id}/320 tabs`);
            mkdirSync(SHOTS, { recursive: true });
            if (row.id === "system") {
              const bodies320: Awaited<ReturnType<typeof paneBody>>[] = [];
              for (const view of views) {
                await frame.locator(`nav button[data-view="${view}"]`).click();
                await restFrame(page);
                const body = await paneBody(frame);
                bodies320.push(body);
                await page.locator("#f").screenshot({
                  path: join(SHOTS, `${row.id}-320-${body.pane || view}.png`),
                });
                await assertClearOfNav(frame, `${row.id}/320/${body.pane}`);
              }
              assertPairwiseDistinct(bodies320, `${row.id}/320`);
              await frame.locator(`nav button[data-view="${views[0]!}"]`).click();
              await restFrame(page);
            }
            await page.locator("#f").screenshot({ path: join(SHOTS, `${row.id}-320.png`) });
            try {
              mkdirSync(AFTER, { recursive: true });
              await page.locator("#f").screenshot({ path: join(AFTER, `${row.id}-320.png`) });
            } catch {
              /* CI without scorecard dir */
            }
            if (row.id === "system") {
              const sheet = await frame.locator("html").evaluate(() => {
                const cta = document.querySelector(".home-first .btn") as HTMLElement | null;
                const box = cta?.getBoundingClientRect();
                return {
                  h1: [...document.querySelectorAll("header h1")].map((el) => (el.textContent || "").trim()),
                  kicker: (document.querySelector("header .kicker")?.textContent || "").trim(),
                  ctaW: box?.width || 0,
                  ctaH: box?.height || 0,
                };
              });
              assert.equal(sheet.h1.length, 1, `${row.id}/320 titles ${sheet.h1.join("|")}`);
              assert.notEqual(sheet.kicker, "Lista");
              assert.ok(sheet.ctaW >= 200, `${row.id}/320 CTA width ${sheet.ctaW}`);
              assert.ok(sheet.ctaH >= 44, `${row.id}/320 CTA height ${sheet.ctaH}`);
              await frame.locator(`nav button[data-view="${views[1]!}"]`).click();
              await frame.locator("#n").waitFor({ timeout: 4000 });
              await frame.locator("#n").fill("Voce vera");
              if (await frame.locator("#k").count()) await frame.locator("#k").fill("dettaglio");
              if (await frame.locator("#note").count()) await frame.locator("#note").fill("nota utile");
              await frame.locator('#fnew [data-act="save"]').click();
              await restFrame(page);
              await frame.locator(`nav button[data-view="${views[0]!}"]`).click();
              await restFrame(page);
              const homePaint = await frame.locator("html").evaluate(() => ({
                pane: document.querySelector("[data-fenix-pane]")?.getAttribute("data-fenix-pane") || "",
                lists: document.querySelectorAll(".pocket-list").length,
                recent: [...document.querySelectorAll(".home-recent h2")].map((el) => (el.textContent || "").trim()),
              }));
              assert.equal(homePaint.pane, "home");
              assert.equal(homePaint.lists, 0);
              assert.ok(homePaint.recent.includes("Voce vera"), homePaint.recent.join(","));
              await page.locator("#f").screenshot({ path: join(SHOTS, `${row.id}-320-populated.png`) });
              await frame.locator(`nav button[data-view="${views[2]!}"]`).click();
              await restFrame(page);
              const populated = await frame.locator("html").evaluate(() => {
                const ul = document.querySelector(".pocket-list");
                const cs = ul ? getComputedStyle(ul) : null;
                const li = document.querySelector(".pocket-list > li") as HTMLElement | null;
                const box = li?.getBoundingClientRect();
                return {
                  pane: document.querySelector("[data-fenix-pane]")?.getAttribute("data-fenix-pane") || "",
                  list: cs?.listStyleType || "",
                  pad: cs ? Number.parseFloat(cs.paddingLeft) : 99,
                  left: box?.left || 0,
                  right: box?.right || 0,
                  vw: window.innerWidth,
                  notes: [...document.querySelectorAll(".pocket-list .notes")].map((el) => (el.textContent || "").trim()),
                  acts: document.querySelectorAll('.pocket-list [data-act]').length,
                };
              });
              assert.equal(populated.pane, "elenco");
              assert.equal(populated.list, "none", `${row.id}/320 list-style`);
              assert.ok(populated.pad < 1, `${row.id}/320 ul pad`);
              assert.ok(populated.left >= 4, `${row.id}/320 left ${populated.left}`);
              assert.ok(populated.right <= populated.vw - 4, `${row.id}/320 right ${populated.right}/${populated.vw}`);
              assert.ok(populated.acts >= 2, `${row.id}/320 actions`);
              for (const note of populated.notes) assert.doesNotMatch(note, /nuovo|^—$|—\s*·/);
              await assertClearOfNav(frame, `${row.id}/320/elenco-pop`);
              await page.locator("#f").screenshot({ path: join(SHOTS, `${row.id}-320-elenco-populated.png`) });
              const personaView = views[3];
              assert.ok(personaView, `${row.id}/320 persona tab`);
              await frame.locator(`nav button[data-view="${personaView}"]`).click();
              await restFrame(page);
              const personaPop = await paneBody(frame);
              assert.equal(personaPop.pane, "persona");
              await page.locator("#f").screenshot({ path: join(SHOTS, `${row.id}-320-persona-populated.png`) });
              await frame.locator('[data-act="wipe-ask"]').click();
              await restFrame(page);
              assert.equal(await frame.locator('[data-act="wipe-confirm"]').count(), 1);
              await frame.locator('[data-act="wipe-confirm"]').click();
              await frame.locator("html:not([data-fenix-persist='busy'])").waitFor({ timeout: 8000 });
              await restFrame(page);
              await page.locator("#f").evaluate((el, srcDoc: string) => {
                (el as HTMLIFrameElement).srcdoc = srcDoc;
              }, src);
              await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
              await restFrame(page);
              await frame.locator(`nav button[data-view="${personaView}"]`).click();
              await restFrame(page);
              const personaEmpty = await frame.locator("html").evaluate(() => ({
                count: Number(document.querySelector(".home-count")?.getAttribute("data-count") || "99"),
                items: document.querySelectorAll("[data-id]").length,
              }));
              assert.equal(personaEmpty.count, 0, `${row.id}/320 persona wipe ${personaEmpty.count}`);
              assert.equal(personaEmpty.items, 0);
              await assertClearOfNav(frame, `${row.id}/320/persona-empty`);
            }
            await crudRoundtrip(page, frame, src, views[1]!, views[2]!, `Intent ${row.id} 320`);
            await restFrame(page);
            await page.locator("#f").screenshot({ path: join(SHOTS, `${row.id}-320-after-crud.png`) });
            try {
              mkdirSync(AFTER, { recursive: true });
              await page.locator("#f").screenshot({ path: join(AFTER, `${row.id}-320-after-crud.png`) });
            } catch {
              /* CI without scorecard dir */
            }
            assert.equal(errors.length, 0, `${row.id}/320 ${errors.join(" | ")}`);
          } finally {
            await page.close();
          }
        }
      }
    } finally {
      await browser.close();
    }
    mkdirSync(SHOTS, { recursive: true });
    writeFileSync(
      join(SHOTS, "manifest.json"),
      `${JSON.stringify(
        {
          parent: GRAPHIC_INTENT_PARENT_SHA,
          before,
          after: files,
          note: "composeProduct+repairBuild(declared mock)+prepareSrcDoc. First-screen shots wait for real settle (no #err/#toast mask). After-CRUD is a separate file. Tab ON/OFF contrast>=4.5 at D/T/M/320. Shorthand font:700 22px/1.2 and 22px/ 1.2 keep size/weight/lh. SYSTEM empty first-run, adaptive sheet not a single petrol, one title, CTA >=200x44, pocket-list list-style none, no — · nuovo. Four pairwise-distinct panes, Persona wipe-ask/confirm/reload empty, 320/390 content above nav. Hash is movement, not a score. Not 9/10. Not premium/parity.",
        },
        null,
        2,
      )}\n`,
    );
    assert.equal(files.length, 6);
    const mustMove = /^(system|serif)-[DTM]\.png$/;
    for (const file of files) {
      const prior = before.find((b) => b.name === file.name);
      assert.ok(prior, file.name);
      if (mustMove.test(file.name)) {
        assert.notEqual(file.sha256, prior!.sha256, `${file.name} after must move from parent 76414c7`);
      }
      assert.equal(existsSync(join(BEFORE, file.name)), true);
    }
  });

  it("three SYSTEM briefs with history paint distinct computed sheets at 390", async () => {
    const briefs = [
      `${formatPrefix("app")}${INTENT_SYSTEM_PROMPT}`,
      `${formatPrefix("app")}${INTENT_IPHONE_IT_PROMPT}. Font system-ui primario, tab Home Aggiungi Persona.`,
      `${formatPrefix("app")}Taccuino di bordo: font di sistema primario, tab Home Aggiungi Persona, elenco e CRUD.`,
    ];
    const products: ReturnType<typeof composeProduct>[] = [];
    for (const brief of briefs) {
      const recent = products.map((p) => ({
        bg: p.tokens.palette.bg,
        surface: p.tokens.palette.surface,
        accent: p.tokens.palette.accent,
      }));
      products.push(composeProduct(brief, { recent }));
    }
    const sigs = products.map((p) => `${p.tokens.palette.bg}|${p.tokens.palette.accent}`.toLowerCase());
    assert.equal(new Set(sigs).size, 3, sigs.join(" "));
    assert.ok(!products.every((p) => p.tokens.palette.accent.toLowerCase() === "#125e57"));
    const browser = await launchChromium();
    try {
      const painted: string[] = [];
      for (const [i, product] of products.entries()) {
        const src = prepareSrcDoc(product.html, product.tokens.palette, `system-hist-${i}`, product.grammar.kind);
        const page = await isolatedPage(browser, { viewport: { width: 390, height: 844 } });
        try {
          await page.setContent(PERSIST_HOST, { waitUntil: "domcontentloaded", timeout: 15000 });
          await page.locator("#f").evaluate((el, srcDoc: string) => {
            (el as HTMLIFrameElement).srcdoc = srcDoc;
          }, src);
          const frame = page.frameLocator("#f");
          await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
          await restFrame(page);
          const paintedSheet = await frame.locator("html").evaluate(() => ({
            bg: getComputedStyle(document.body).backgroundColor,
            accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
            chroma: document.documentElement.getAttribute("data-chroma") || "",
            heroBg: getComputedStyle(document.querySelector(".home-hero") || document.body).backgroundColor,
          }));
          painted.push(`${paintedSheet.bg}|${paintedSheet.accent}|${paintedSheet.chroma}|${paintedSheet.heroBg}`);
          const overflow = await frame.locator("html").evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          );
          assert.ok(overflow <= 8, `hist ${i} overflow ${overflow}`);
          mkdirSync(SHOTS, { recursive: true });
          const histShot = join(SHOTS, `system-hist-${i}-M.png`);
          await page.locator("#f").screenshot({ path: histShot });
          try {
            mkdirSync(AFTER, { recursive: true });
            await page.locator("#f").screenshot({ path: join(AFTER, `system-hist-${i}-M.png`) });
          } catch {
            /* CI without scorecard dir */
          }
        } finally {
          await page.close();
        }
      }
      assert.equal(new Set(painted).size, 3, painted.join(" | "));
    } finally {
      await browser.close();
    }
  });

  it("applies system computed style on Italian stile iPhone after repairBuild mock on CSS without vars", async () => {
    const brief = `${formatPrefix("app")}${INTENT_IPHONE_IT_PROMPT}. Font system-ui primario, tab Home Aggiungi Persona, elenco e CRUD.`;
    const composed = composeProduct(brief);
    assert.match(composed.html, /data-intent-type="system"/);
    const repaired = await repairThroughDeclaredMock(
      brief,
      composed.html,
      composed.grammar.kind,
      "Lista",
      composed.tokens.palette,
    );
    const src = prepareSrcDoc(repaired.html, composed.tokens.palette, "intent-iphone-it", repaired.kind);
    assert.match(src, /data-intent-type="system"/);
    assert.match(src, /--body:ui-sans-serif,system-ui,-apple-system/);
    assert.doesNotMatch(src, /font-family:\s*Georgia/);
    const browser = await launchChromium();
    try {
      const page = await isolatedPage(browser, { viewport: { width: 390, height: 844 } });
      const errors: string[] = [];
      page.on("pageerror", (err) => {
        if (!isBlockedPublicNetworkError(String(err))) errors.push(String(err));
      });
      try {
        await page.setContent(PERSIST_HOST, { waitUntil: "domcontentloaded", timeout: 15000 });
        await page.locator("#f").evaluate((el, srcDoc: string) => {
          (el as HTMLIFrameElement).srcdoc = srcDoc;
        }, src);
        const frame = page.frameLocator("#f");
        await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
        await restFrame(page);
        const painted = await frame.locator("html").evaluate(() => {
          const body = getComputedStyle(document.body);
          const h1 = document.querySelector("h1, .brand, header h1");
          return {
            bodyFamily: body.fontFamily,
            headingFamily: h1 ? getComputedStyle(h1).fontFamily : body.fontFamily,
            intentType: document.documentElement.getAttribute("data-intent-type"),
            tabs: [...document.querySelectorAll("nav button[data-view] span")].map((s) =>
              (s.textContent || "").trim(),
            ),
            views: [...document.querySelectorAll("nav button[data-view]")].map(
              (b) => b.getAttribute("data-view") || "",
            ),
          };
        });
        assert.equal(painted.intentType, "system");
        assert.doesNotMatch(painted.bodyFamily, /Georgia/i);
        assert.match(painted.bodyFamily, /system-ui|ui-sans-serif|-apple-system|sans-serif/i);
        assert.ok(painted.tabs.includes("Home"), painted.tabs.join(","));
        assert.ok(painted.tabs.includes("Aggiungi"), painted.tabs.join(","));
        const formView = painted.views[1];
        const listView = painted.views[2];
        assert.ok(formView && listView);
        await crudRoundtrip(page, frame, src, formView, listView, "Intent it M");
        assert.equal(errors.length, 0, errors.join(" | "));
      } finally {
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });

  it("computed styles drop Georgia from font shorthand and body.app/h1.title after declared repairBuild mock, not a live controller-edit", async () => {
    const brief = "Font system-ui primario";
    const dropped = `<!DOCTYPE html><html lang="it"><head>
<style>body{font:16px Georgia}h1{font:32px Georgia}body.app,h1.title{font-family:Georgia}p.quote{font-family:Georgia}</style>
</head><body class="app"><h1 class="title">Lista</h1><p class="quote">Georgia, 1820</p><main id="main"><p>voce</p></main></body></html>`;
    const repaired = await repairThroughDeclaredMock(brief, dropped, "app", "Lista");
    const src = prepareSrcDoc(repaired.html, repaired.palette, "intent-shorthand-browser", "app");
    assert.match(src, /data-intent-type="system"/);
    assert.doesNotMatch(src, /body\{font:16px Georgia/);
    assert.match(src, /p\.quote\{font-family:Georgia/);
    const browser = await launchChromium();
    try {
      const page = await isolatedPage(browser, { viewport: { width: 390, height: 844 } });
      const errors: string[] = [];
      page.on("pageerror", (err) => {
        if (!isBlockedPublicNetworkError(String(err))) errors.push(String(err));
      });
      page.on("console", (msg) => {
        if (msg.type() === "error" && !isBlockedPublicNetworkError(msg.text())) errors.push(msg.text());
      });
      try {
        await page.setContent(PERSIST_HOST, { waitUntil: "domcontentloaded", timeout: 15000 });
        await page.locator("#f").evaluate((el, srcDoc: string) => {
          (el as HTMLIFrameElement).srcdoc = srcDoc;
        }, src);
        const frame = page.frameLocator("#f");
        await frame.locator("h1.title").waitFor({ timeout: 8000 });
        const painted = await frame.locator("html").evaluate(() => {
          const body = getComputedStyle(document.body);
          const h1 = document.querySelector("h1.title");
          const quote = document.querySelector("p.quote");
          const hs = h1 ? getComputedStyle(h1) : null;
          return {
            bodyFamily: body.fontFamily,
            headingFamily: hs ? hs.fontFamily : "",
            headingSize: hs ? hs.fontSize : "",
            quoteFamily: quote ? getComputedStyle(quote).fontFamily : "",
            quoteText: quote ? (quote.textContent || "") : "",
            intentType: document.documentElement.getAttribute("data-intent-type"),
          };
        });
        assert.equal(painted.intentType, "system");
        assert.doesNotMatch(painted.bodyFamily, /Georgia/i);
        assert.doesNotMatch(painted.headingFamily, /Georgia/i);
        assert.match(painted.bodyFamily, /system-ui|ui-sans-serif|-apple-system|sans-serif/i);
        assert.equal(painted.headingSize, "32px");
        assert.match(painted.quoteFamily, /Georgia/i);
        assert.match(painted.quoteText, /Georgia, 1820/);
        assert.equal(errors.length, 0, errors.join(" | "));
      } finally {
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });

  it("computed styles keep weight/style/size/line-height on shorthand (system and serif, after prepareSrcDoc)", async () => {
    const fixture = `<!DOCTYPE html><html lang="it"><head><style>
h1.w{font:700 22px/1.2 Georgia}
h1.i{font:italic 600 1.5rem/1.3 Georgia}
h1.s{font:32px Georgia}
h1.q{font:700 22px/1.2 Georgia !important}
h1.title{font:italic 600 1.5rem/1.3 Georgia}
h1.b{font:700 22px/ 1.2 Georgia}
h1.c{font:700 22px /1.2 Georgia}
h1.d{font:700 22px / 1.2 Georgia}
button.cta{font:700 14px/1 Georgia}
p.quote{font-family:Georgia}
</style></head><body class="app">
<h1 class="w">Peso</h1>
<h1 class="i">Corsivo</h1>
<h1 class="s">Semplice</h1>
<h1 class="q">Importante</h1>
<h1 class="title">Qualificato</h1>
<h1 class="b">SlashB</h1>
<h1 class="c">SlashC</h1>
<h1 class="d">SlashD</h1>
<button class="cta">Ok</button>
<p class="quote">Georgia, 1820</p>
</body></html>`;
    const sysHtml = enforceGraphicIntent(fixture, "Font system-ui primario. Voglio una app stile iPhone.");
    const serHtml = enforceGraphicIntent(fixture, INTENT_SERIF_PROMPT);
    assert.match(sysHtml, /font:700 22px\/1\.2 ui-sans-serif/);
    assert.match(sysHtml, /h1\.b\{font:700 22px\/ 1\.2 ui-sans-serif/);
    assert.match(sysHtml, /h1\.c\{font:700 22px \/1\.2 ui-sans-serif/);
    assert.match(sysHtml, /h1\.d\{font:700 22px \/ 1\.2 ui-sans-serif/);
    assert.doesNotMatch(sysHtml, /h1\.b\{font:700 22px\/ ui-sans-serif/);
    assert.doesNotMatch(sysHtml, /h1\.w\{font:700 ui-sans-serif/);
    assert.match(serHtml, /font:700 22px\/1\.2 "Literata"/);
    assert.doesNotMatch(serHtml, /h1\.w\{font:700 22px\/1\.2 ui-sans-serif/);
    const sysSrc = prepareSrcDoc(sysHtml, { bg: "#efe6d4" }, "intent-geom-sys", "app");
    const serSrc = prepareSrcDoc(serHtml, { bg: "#f7f1e4" }, "intent-geom-ser", "app");
    const repaired = await repairThroughDeclaredMock(
      "Font system-ui primario. Voglio una app stile iPhone.",
      fixture,
      "app",
      "Lista",
    );
    const repairedSrc = prepareSrcDoc(repaired.html, repaired.palette, "intent-geom-repair", "app");
    assert.match(repairedSrc, /font:700 22px\/1\.2 ui-sans-serif/);
    assert.doesNotMatch(repairedSrc, /h1\.w\{font:700 ui-sans-serif/);

    const readPaint = () => {
      const take = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          family: cs.fontFamily,
          size: cs.fontSize,
          weight: String(cs.fontWeight),
          style: cs.fontStyle,
          lh: cs.lineHeight,
          text: (el.textContent || "").trim(),
        };
      };
      return {
        w: take("h1.w"),
        i: take("h1.i"),
        s: take("h1.s"),
        q: take("h1.q"),
        title: take("h1.title"),
        b: take("h1.b"),
        c: take("h1.c"),
        d: take("h1.d"),
        cta: take("button.cta"),
        quote: take("p.quote"),
      };
    };

    type PaintedFace = {
      family: string;
      size: string;
      weight: string;
      style: string;
      lh: string;
      text: string;
    };
    const assertGeom = (
      painted: Record<string, PaintedFace | null>,
      familyRe: RegExp,
      antiRe: RegExp,
      label: string,
    ) => {
      for (const key of ["w", "i", "s", "q", "title", "b", "c", "d"]) {
        const face = painted[key];
        assert.ok(face, `${label} missing ${key}`);
        assert.match(face!.family, familyRe, `${label} ${key} family ${face!.family}`);
        assert.doesNotMatch(face!.family, antiRe, `${label} ${key} anti ${face!.family}`);
      }
      assert.equal(painted.w!.size, "22px", `${label} w size`);
      assert.equal(painted.w!.weight, "700", `${label} w weight`);
      assert.equal(painted.w!.style, "normal", `${label} w style`);
      assert.equal(painted.w!.lh, "26.4px", `${label} w lh`);
      assert.equal(painted.i!.size, "24px", `${label} i size`);
      assert.equal(painted.i!.weight, "600", `${label} i weight`);
      assert.equal(painted.i!.style, "italic", `${label} i style`);
      assert.equal(painted.i!.lh, "31.2px", `${label} i lh`);
      assert.equal(painted.s!.size, "32px", `${label} s size`);
      assert.equal(painted.q!.size, "22px", `${label} q size`);
      assert.equal(painted.q!.weight, "700", `${label} q weight`);
      assert.equal(painted.q!.lh, "26.4px", `${label} q lh`);
      assert.equal(painted.title!.size, "24px", `${label} title size`);
      assert.equal(painted.title!.weight, "600", `${label} title weight`);
      assert.equal(painted.title!.style, "italic", `${label} title style`);
      assert.equal(painted.b!.size, "22px", `${label} b size`);
      assert.equal(painted.b!.weight, "700", `${label} b weight`);
      assert.equal(painted.b!.lh, "26.4px", `${label} b lh`);
      assert.equal(painted.c!.size, "22px", `${label} c size`);
      assert.equal(painted.c!.lh, "26.4px", `${label} c lh`);
      assert.equal(painted.d!.size, "22px", `${label} d size`);
      assert.equal(painted.d!.lh, "26.4px", `${label} d lh`);
      assert.equal(painted.cta!.size, "14px", `${label} cta size`);
      assert.equal(painted.cta!.weight, "700", `${label} cta weight`);
      assert.match(painted.cta!.family, /Georgia/i, `${label} cta keeps Georgia`);
      assert.match(painted.quote!.family, /Georgia/i, `${label} quote family`);
      assert.equal(painted.quote!.text, "Georgia, 1820");
    };

    const browser = await launchChromium();
    try {
      const cases: Array<[string, string, RegExp, RegExp]> = [
        ["system-enforce", sysSrc, /system-ui|ui-sans-serif|-apple-system|sans-serif/i, /Georgia/i],
        ["serif-enforce", serSrc, /literata|georgia|times|ui-serif/i, /ui-sans-serif|system-ui|-apple-system/i],
        ["system-repair", repairedSrc, /system-ui|ui-sans-serif|-apple-system|sans-serif/i, /Georgia/i],
      ];
      for (const [label, src, familyRe, antiRe] of cases) {
        const page = await isolatedPage(browser, { viewport: { width: 390, height: 844 } });
        try {
          await page.setContent(PERSIST_HOST, { waitUntil: "domcontentloaded", timeout: 15000 });
          await page.locator("#f").evaluate((el, srcDoc: string) => {
            (el as HTMLIFrameElement).srcdoc = srcDoc;
          }, src);
          const frame = page.frameLocator("#f");
          await frame.locator("h1.w").waitFor({ timeout: 8000 });
          const painted = await frame.locator("html").evaluate(readPaint);
          assertGeom(painted, familyRe, antiRe, label);
        } finally {
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });
});
