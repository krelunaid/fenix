import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chromium, type Page } from "playwright";
import { DEMOS } from "./demos.ts";
import { prepareSrcDoc } from "./color-scheme.ts";
import { waitForFenixReady } from "../../../scripts/fenix-ready.mjs";
import { parseCssColor, type CssRgb } from "./visual-quality.ts";

const CRAFT = ["catenaria", "grottaglie", "corvo", "kiln"] as const;

type Sample = {
  role: string;
  sel: string;
  ratio: number;
  color: string;
  bg: string;
  text: string;
};

function launch() {
  return chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

async function openDemo(page: Page, id: (typeof CRAFT)[number]) {
  const demo = DEMOS[id];
  const src = prepareSrcDoc(demo.html, demo.palette, id, demo.kind);
  await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 15000 });
  await waitForFenixReady(page, 8000);
}

function measureRendered() {
  function parse(c: string) {
    const s = (c || "").trim();
    if (!s || s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    const m = s.match(
      /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i,
    );
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] };
  }
  function lum(c: { r: number; g: number; b: number }) {
    const to = (v: number) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * to(c.r) + 0.7152 * to(c.g) + 0.0722 * to(c.b);
  }
  function contrast(
    a: { r: number; g: number; b: number },
    b: { r: number; g: number; b: number },
  ) {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function composite(
    fg: { r: number; g: number; b: number; a: number },
    bg: { r: number; g: number; b: number; a: number },
  ) {
    const a = Math.min(1, Math.max(0, fg.a));
    if (a >= 0.999) return { r: fg.r, g: fg.g, b: fg.b, a: 1 };
    return {
      r: fg.r * a + bg.r * (1 - a),
      g: fg.g * a + bg.g * (1 - a),
      b: fg.b * a + bg.b * (1 - a),
      a: 1,
    };
  }
  function bgOf(el: Element) {
    const stack: { r: number; g: number; b: number; a: number }[] = [];
    let n: Element | null = el;
    while (n) {
      const p = parse(getComputedStyle(n).backgroundColor);
      if (p && p.a > 0.04) stack.push(p);
      n = n.parentElement;
    }
    let acc = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = stack.length - 1; i >= 0; i--) acc = composite(stack[i], acc);
    return acc;
  }
  function sample(sel: string, role: string) {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (!fg) return null;
    const bg = bgOf(el);
    const ink = composite(fg, bg);
    return {
      role,
      sel,
      color: cs.color,
      bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
      ratio: contrast(ink, bg),
      text: ((el as HTMLElement).innerText || el.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 48),
    };
  }
  return {
    main: sample("h1", "main") || sample("main", "main"),
    muted:
      sample("#subtitle", "muted") ||
      sample(".muted", "muted") ||
      sample("header p", "muted") ||
      sample("label", "muted"),
    form: sample("form input, form textarea, input, textarea, select", "form"),
    table: sample("table td, .table td, tbody td", "table"),
    ready: document.documentElement.getAttribute("data-fenix-ready"),
  };
}

function clippedText() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const out: { t: string; left: number; right: number }[] = [];
  const nodes = document.querySelectorAll(
    "h1,h2,h3,p,span,a,li,td,th,label,button,footer span,.mark,text",
  );
  for (const el of nodes) {
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.bottom < 0 || r.top > vh) continue;
    if (r.left < -1 || r.right > vw + 1) {
      out.push({ t: t.slice(0, 80), left: Math.round(r.left), right: Math.round(r.right) });
    }
  }
  const addr = [...document.querySelectorAll("p, text")].find((el) =>
    /via Madama Cristina 41/i.test(el.textContent || ""),
  );
  const ar = addr ? addr.getBoundingClientRect() : null;
  return {
    out,
    addr: ar
      ? { left: ar.left, right: ar.right, top: ar.top, text: addr!.textContent }
      : null,
    vw,
  };
}

describe("rendered contrast after prepareSrcDoc", () => {
  it("measures AA contrast on main/muted/form/table at 390 and 1280", async () => {
    const browser = await launch();
    try {
      for (const id of CRAFT) {
        for (const frame of [
          { width: 390, height: 844 },
          { width: 1280, height: 800 },
        ]) {
          const page = await browser.newPage({
            viewport: { width: frame.width, height: frame.height },
          });
          await openDemo(page, id);
          const measured = await page.evaluate(measureRendered);
          assert.equal(measured.ready, "1", `${id}@${frame.width} ready`);
          assert.ok(measured.main, `${id}@${frame.width} main sample`);
          assert.ok(
            measured.main!.ratio >= 4.5,
            `${id}@${frame.width} main contrast ${measured.main!.ratio.toFixed(2)} (${measured.main!.color} on ${measured.main!.bg})`,
          );
          if (measured.muted) {
            assert.ok(
              measured.muted.ratio >= 3,
              `${id}@${frame.width} muted contrast ${measured.muted.ratio.toFixed(2)}`,
            );
          }
          if (measured.form) {
            assert.ok(
              measured.form.ratio >= 4.5,
              `${id}@${frame.width} form contrast ${measured.form.ratio.toFixed(2)} (${measured.form.color} on ${measured.form.bg})`,
            );
          }
          if (measured.table) {
            assert.ok(
              measured.table.ratio >= 4.5,
              `${id}@${frame.width} table contrast ${measured.table.ratio.toFixed(2)}`,
            );
          }
          if (id === "catenaria") {
            assert.ok(measured.form, "catenaria form");
            assert.ok(measured.table, "catenaria table");
            const fg = parseCssColor(measured.main!.color);
            assert.ok(fg, "parse catenaria ink");
            assert.ok(
              (fg as CssRgb).r + (fg as CssRgb).g + (fg as CssRgb).b > 400,
              `catenaria ink must stay light, got ${measured.main!.color}`,
            );
          }
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });
});

describe("Grottaglie responsive desktop", () => {
  it("keeps a phone tabbar at 390 and a useful desktop shell at 768/1280", async () => {
    const browser = await launch();
    try {
      const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await openDemo(phone, "grottaglie");
      const phoneLayout = await phone.evaluate(() => {
        const tabs = document.querySelector(".tabs") as HTMLElement;
        const hero = document.querySelector(".hero") as HTMLElement;
        const card = document.querySelector(".card") as HTMLElement;
        const main = document.querySelector("main") as HTMLElement;
        const tr = tabs.getBoundingClientRect();
        const hr = hero ? hero.getBoundingClientRect() : null;
        return {
          tabTop: tr.top,
          tabWidth: tr.width,
          vh: window.innerHeight,
          heroH: hr ? hr.height : 0,
          cardTop: card ? card.getBoundingClientRect().top : -1,
          mainOverflow: getComputedStyle(main).overflowY,
        };
      });
      assert.ok(
        phoneLayout.tabWidth > 300 && phoneLayout.tabWidth <= 390,
        "390 tabbar is phone-wide",
      );
      assert.ok(phoneLayout.tabTop > phoneLayout.vh - 120, "390 tabbar sits at the bottom");
      assert.ok(phoneLayout.heroH > 80 && phoneLayout.heroH <= 240, "390 hero stays compact");
      assert.ok(
        /auto|scroll/.test(phoneLayout.mainOverflow),
        `390 main must scroll, got ${phoneLayout.mainOverflow}`,
      );
      await phone.close();

      for (const frame of [
        { width: 768, height: 1024 },
        { width: 1280, height: 800 },
      ]) {
        const page = await browser.newPage({
          viewport: { width: frame.width, height: frame.height },
        });
        await openDemo(page, "grottaglie");
        const layout = await page.evaluate(() => {
          const tabs = document.querySelector(".tabs") as HTMLElement;
          const hero = document.querySelector(".hero") as HTMLElement;
          const cards = [...document.querySelectorAll(".card")];
          const tr = tabs.getBoundingClientRect();
          const hr = hero.getBoundingClientRect();
          const furnace = cards.find((c) => /Forno|attivi/i.test(c.textContent || ""));
          return {
            tabWidth: tr.width,
            tabLeft: tr.left,
            tabTop: tr.top,
            heroH: hr.height,
            furnaceTop: furnace ? furnace.getBoundingClientRect().top : -1,
            vh: window.innerHeight,
          };
        });
        assert.ok(
          layout.heroH <= 220,
          `${frame.width} hero ${layout.heroH}px must not eat the fold`,
        );
        assert.ok(
          layout.tabWidth < 320,
          `${frame.width} tabs ${layout.tabWidth}px must be a sidebar, not a 1280 bar`,
        );
        assert.ok(
          layout.tabTop < layout.vh / 2,
          `${frame.width} tabs must sit in the side column, not as a bottom bar`,
        );
        assert.ok(
          layout.furnaceTop >= 0 && layout.furnaceTop < layout.vh - 80,
          `${frame.width} operational card missing above the fold (top=${layout.furnaceTop})`,
        );
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });
});

describe("Corvo clipping", () => {
  it("keeps via Madama Cristina 41 inside the 390 viewport", async () => {
    const browser = await launch();
    try {
      for (const frame of [
        { width: 390, height: 844 },
        { width: 768, height: 1024 },
        { width: 1280, height: 800 },
      ]) {
        const page = await browser.newPage({
          viewport: { width: frame.width, height: frame.height },
        });
        await openDemo(page, "corvo");
        const hits = await page.evaluate(clippedText);
        assert.ok(hits.addr, `${frame.width} address node`);
        assert.ok(
          hits.addr!.left >= -0.5 && hits.addr!.right <= hits.vw + 0.5,
          `${frame.width} address clipped ${JSON.stringify(hits.addr)}`,
        );
        assert.equal(
          hits.out.length,
          0,
          `${frame.width} text outside viewport: ${JSON.stringify(hits.out)}`,
        );
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });
});
