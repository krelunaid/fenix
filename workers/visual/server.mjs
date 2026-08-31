import { createServer } from "node:http";

/**
 * Worker visivo Fenix — 5 giri (una tab ciascuno) Playwright + grok-build-0.1.
 * Env: XAI_API_KEY, PORT (8787). Tutte le chiamate xAI usano grok-build-0.1, payload Chat Completions senza extra flags.
 * POST /polish  { prompt, html }  →  { html, name, log }
 */
const PORT = Number(process.env.PORT || 8787);
const MODEL = "grok-build-0.1";
const XAI = "https://api.x.ai/v1/chat/completions";
const PASSES = 5;

const SYSTEM = `Sei il motore visivo di Fenix. Vedi uno screenshot TELEFONO 390×844 e l'HTML.
Legge grafica: chrome da prodotto (tab in basso se app), identità DAL MESTIERE.
Barbiere: crema + inchiostro + ruggine. Luna park: giallo + inchiostro. Acqua: cloro + terracotta. Espresso: zinco + carta.
Testo --fg su --bg contrasto 4.5:1. Niente grigio su grigio. Niente parole Apple/iOS nel prodotto.
- font dalla direzione visiva (serif manifesto + sans/mono bottega). Vietato Inter, Manrope, -apple-system, SF Pro come default.
- raggio, aria e CTA dal brief. Vietato card bianche + CTA pillola blu + coppia #f5f5f7+#0071e3.
ICONE (giro dedicato, non opzionale):
- Ridisegna TUTTE le SVG: pittogramma del mestiere, path originali, viewBox 0 0 24 24, stroke 1.8 round, fill none tranne .on
- 5 tab = 5 silhouette diverse, si capiscono senza label. Vietato cerchio+lettera, emoji, icone clonate
- Icona app 52px rx 13 in header + rel=icon, 2 colori DELLA PALETTE (mai #1d1d1f / #0071e3 di default)
Correggi chrome/CSS/icone. Se lo screenshot è BIANCO o main vuoto, RIEMPI la home: metriche, oggetto del mestiere, CTA, form. Non lasciare una pagina bianca.
Copia i tag <script> identici se il JS già fa add/save. Se non c'è contenuto visibile, puoi aggiungere HTML in main.
Canvas: body colonna 100dvh, header.fk-top, main.fk-main, nav.fk-tab.
Non scrivere le parole Apple, iOS, Fenix, Grok nel prodotto.
Rispondi SOLO con la schermata di QUESTA tab, non l'HTML intero:
<<<SCREEN id="home|new|list|stats|more">>>
<!-- solo il contenuto di main di QUESTA tab: metriche, form o lista. Niente html/body/nav -->
<<<END>>>
Se proprio non puoi, allora META+HTML completo come ultima spiaggia.`;

const TAB_IDS = ["home", "new", "list", "stats", "more"];
const TSX_NAME = { home: "Home", new: "New", list: "List", stats: "Stats", more: "More" };

function htmlToJsx(inner, comp) {
  let j = String(inner || "")
    .replace(/\sclass=/gi, " className=")
    .replace(/\sfor=/gi, " htmlFor=")
    .replace(/\sstroke-width=/gi, " strokeWidth=")
    .replace(/\sstroke-linecap=/gi, " strokeLinecap=")
    .replace(/\sstroke-linejoin=/gi, " strokeLinejoin=")
    .replace(/\sviewbox=/gi, " viewBox=")
    .replace(/<(img|input|br|hr)([^>]*?)\/?>/gi, "<$1$2 />")
    .trim();
  if (!j) j = "<p>Vuoto</p>";
  return `export default function ${comp}() {
  return (
    <div className="fk-screen">
      ${j}
    </div>
  );
}
`;
}

function parseScreen(text) {
  const m = text.match(/<<<SCREEN(?:\s+id=["']?(\w+)["']?)?>>>\s*([\s\S]*?)(?:<<<END>>>|$)/i);
  if (!m) return null;
  let inner = m[2].trim();
  inner = inner.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "");
  inner = inner.replace(/<!DOCTYPE[\s\S]*?<body[^>]*>/i, "").replace(/<\/body>[\s\S]*$/i, "").trim();
  inner = inner.replace(/<\/?(html|head|body)[^>]*>/gi, "").trim();
  if (inner.length < 24) return null;
  return { id: (m[1] || "").toLowerCase(), inner };
}

function spliceScreen(html, id, inner) {
  if (!html || !inner) return html;
  const tid = TAB_IDS.includes(id) ? id : "home";
  let next = html;
  const tRe = new RegExp(`(<template[^>]*\\bid=["']t-${tid}["'][^>]*>)([\\s\\S]*?)(<\\/template>)`, "i");
  if (tRe.test(next)) {
    next = next.replace(tRe, `$1${inner}$3`);
  } else if (/<\/body>/i.test(next)) {
    next = next.replace(/<\/body>/i, `<template id="t-${tid}">${inner}</template></body>`);
  } else {
    next += `<template id="t-${tid}">${inner}</template>`;
  }
  return next;
}

function restoreHome(html) {
  const m = html.match(/<template[^>]*id=["']t-home["'][^>]*>([\s\S]*?)<\/template>/i);
  if (!m) return html;
  if (!/<main\b/i.test(html)) return html;
  return html.replace(/<main\b[^>]*>[\s\S]*?<\/main>/i, `<main class="fk-main">${m[1]}</main>`);
}

function parseHtml(text) {
  const htmlMatch =
    text.match(/<!DOCTYPE html[\s\S]*?<\/html>/i) || text.match(/<html[\s\S]*?<\/html>/i);
  if (!htmlMatch) return null;
  const html = htmlMatch[0].startsWith("<!DOCTYPE") ? htmlMatch[0] : `<!DOCTYPE html>\n${htmlMatch[0]}`;
  if (html.length < 80) return null;
  const metaMatch = text.match(/<<<META>>>\s*([\s\S]*?)(?:<<<HTML>>>|$)/);
  let meta = {};
  try {
    meta = JSON.parse(metaMatch?.[1]?.trim() || "{}");
  } catch {
    meta = {};
  }
  return { html, meta };
}

function keepScripts(from, to) {
  if (!from || !to) return to;
  const grab = (html) => [...html.matchAll(/<script\b[\s\S]*?<\/script>/gi)].map((m) => m[0]);
  const orig = grab(from);
  if (!orig.length) return to;
  const next = grab(to);
  const origLen = orig.join("").length;
  const nextLen = next.join("").length;
  if (nextLen >= origLen * 0.85) return to;
  const stripped = to.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  const block = orig.join("\n");
  return /<\/body>/i.test(stripped)
    ? stripped.replace(/<\/body>/i, `${block}</body>`)
    : `${stripped}${block}`;
}

function inferTab(instruction) {
  const p = String(instruction || "").toLowerCase();
  if (/form|salva|nuovo|inser|foto|capo|prenot|campo/.test(p)) return 1;
  if (/elenco|lista|vetrina|righe|attese/.test(p)) return 2;
  if (/numer|cassa|stat|total|kpi/.test(p)) return 3;
  if (/staff|altro|impost|team|barbiere/.test(p)) return 4;
  return 0;
}

const GENERATE_SYSTEM = `Motore Fenix. Generi APP a 5 schermate, non un sito, salvo brief "sito web".
Italiano. Palette dal mestiere, mai #f5f5f7+#0071e3. Testo contrasto AA 4.5:1.
Ogni schermata PIENA (numeri, form o lista). Form che salvano.
Niente Apple, iOS, Grok, Fenix, Inter, Manrope nel prodotto.
Rispondi SOLO:
<<<META>>>
{"name":"","tagline":"","kind":"app","summary":"","palette":{"bg":"#1a1612","surface":"#2a241c","fg":"#e6dcc8","muted":"#9a8f7a","accent":"#c45c26"}}
<<<FILE path="screens/home.html">>>
inner della home
<<<FILE path="screens/new.html">>>
form
<<<FILE path="screens/list.html">>>
elenco
<<<FILE path="screens/stats.html">>>
<<<FILE path="screens/more.html">>>
<<<HTML>>>
<!DOCTYPE html> con header.fk-top, main, nav.fk-tab 5 data-view, template id=t-home t-new t-list t-stats t-more
<<<END>>>`;

async function generateHero(apiKey, prompt, aspect) {
  try {
    const res = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-imagine-image-2.0",
        prompt: `Photorealistic photo, no text, no logo, no watermark. Subject: ${String(prompt).slice(0, 280)}`,
        aspect_ratio: aspect || "16:9",
        quality: "low",
        n: 1,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.[0]?.url || null;
  } catch {
    return null;
  }
}

function injectHero(html, url) {
  if (!html || !url) return html;
  const phone = /fk-tab|data-view=["']home["']/i.test(html);
  const img = phone
    ? `<img class="fk-hero" src="${url}" alt="" width="400" height="400" style="width:100%;height:140px;object-fit:cover;border-radius:20px;display:block;margin:8px 0 12px"/>`
    : `<img class="fk-hero" src="${url}" alt="" width="1200" height="675" style="width:100%;height:220px;object-fit:cover;border-radius:18px;display:block;margin:0 0 16px"/>`;
  let next = html.replace(/^\s*"\s*\/>/m, "").replace(/>\s*"\s*\/>/g, ">");
  if (/<img\b/i.test(next)) return next.replace(/<img\b[^>]*>/i, img);
  if (/<main\b[^>]*>/i.test(next)) return next.replace(/<main\b[^>]*>/i, (open) => `${open}${img}`);
  return next;
}

async function generate(prompt, html, instruction) {
  const apiKey = (process.env.XAI_API_KEY || "").trim();
  if (!apiKey) throw new Error("Manca XAI_API_KEY");
  const user = [
    `BRIEF:\n${prompt}`,
    html ? `HTML ATTUALE:\n${html.slice(0, 20000)}` : "",
    instruction ? `MODIFICA:\n${instruction}` : "",
    "META + HTML completo ora.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const res = await fetch(XAI, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 8000,
      stream: false,
      messages: [
        { role: "system", content: GENERATE_SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`xAI ${res.status}`);
  const payload = await res.json();
  const text = payload.choices?.[0]?.message?.content ?? "";
  const parsed = parseHtml(text);
  if (!parsed?.html) throw new Error("HTML non valido");
  let out = parsed.html;
  const fileRe = /<<<FILE path="([^"]+)">>>\s*([\s\S]*?)(?=<<<FILE|<<<HTML|<<<END|$)/g;
  const fromGrok = [];
  let m;
  while ((m = fileRe.exec(text))) {
    const path = m[1];
    const content = m[2].trim();
    fromGrok.push({ path, content });
    const sm = path.match(/^screens\/(\w+)\.html$/);
    if (sm) {
      out = spliceScreen(out, sm[1], content);
      const comp = TSX_NAME[sm[1]];
      if (comp) fromGrok.push({ path: `src/screens/${comp}.tsx`, content: htmlToJsx(content, comp) });
    }
  }
  const hero = await generateHero(apiKey, prompt, /fk-tab/i.test(out) ? "1:1" : "16:9");
  if (hero) out = injectHero(out, hero);
  return {
    html: out,
    meta: parsed.meta,
    log: hero ? ["Bozza 5 schermate", "Foto hero"] : ["Bozza 5 schermate"],
    files: fromGrok,
  };
}

async function grok(apiKey, prompt, html, shotB64, pass, instruction, tabId) {
  const user = [
    {
      type: "text",
      text: [
        `GIRO ${pass}/${PASSES}. BRIEF:\n${prompt}`,
        instruction ? `MODIFICA DA TENERE:\n${instruction}\nNon disfare questa modifica.` : "",
        `TAB DA RIFARE: ${tabId || TAB_IDS[pass - 1] || "home"} (è quella nello screenshot).`,
        `HTML (solo per contesto, NON riscriverlo):\n${html.slice(0, 12000)}`,
        `Rispondi con <<<SCREEN id="${tabId || TAB_IDS[pass - 1]}">>> contenuto main di QUESTA tab <<<END>>>. Niente documento intero. Se la tab è vuota, riempila (form / lista / numeri).`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
  if (shotB64) {
    user.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${shotB64}` } });
  }
  const res = await fetch(XAI, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.35,
      max_tokens: 4000,
      stream: false,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`xAI ${res.status} ${await res.text().then((t) => t.slice(0, 180))}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

async function designIcons(apiKey, prompt) {
  const res = await fetch(XAI, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      max_tokens: 2500,
      stream: false,
      messages: [
        {
          role: "system",
          content: `Disegni pittogrammi del mestiere. SOLO JSON, niente markdown:
{"app":"<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'>...</svg>","tabs":[{"id":"home","label":"max8","svg":"<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'>...</svg>"},{"id":"new","label":"","svg":""},{"id":"list","label":"","svg":""},{"id":"stats","label":"","svg":""},{"id":"more","label":"","svg":""}]}
Oggetto del brief. 5 silhouette diverse, leggibili a 24px. Niente lettera, emoji, Lucide copiato. Stroke currentColor, mai #1d1d1f/#0071e3.`,
        },
        { role: "user", content: `BRIEF:\n${prompt}\n\nJSON icone.` },
      ],
    }),
  });
  if (!res.ok) return null;
  const payload = await res.json();
  const text = payload.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const pack = JSON.parse(match[0]);
    if (!pack?.app || !Array.isArray(pack.tabs) || pack.tabs.length < 4) return null;
    return pack;
  } catch {
    return null;
  }
}

function injectIcons(html, pack) {
  if (!html || !pack?.app) return html;
  let next = html;
  const fav = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(pack.app)}"/>`;
  if (/rel=["']icon["']/.test(next)) {
    next = next.replace(/<link[^>]*rel=["']icon["'][^>]*>/i, fav);
  } else if (/<head[^>]*>/i.test(next)) {
    next = next.replace(/<head[^>]*>/i, (open) => `${open}${fav}`);
  }
  const mark = `<span class="fk-appicon" aria-hidden="true" style="width:36px;height:36px;border-radius:9px;background:var(--fg,#1c1712);display:inline-grid;place-items:center;flex-shrink:0">${String(pack.app).replace("<svg", "<svg width='20' height='20'")}</span>`;
  if (!next.includes("fk-appicon")) {
    if (/class="[^"]*fk-hello/.test(next)) {
      next = next.replace(/<h1([^>]*fk-hello[^>]*)>/i, `${mark}<h1$1>`);
    } else {
      next = next.replace(/<header([^>]*)>/i, `<header$1>${mark}`);
    }
  }
  const svgs = (pack.tabs || []).map((t) => t?.svg).filter((s) => typeof s === "string" && s.includes("<svg"));
  if (svgs.length) {
    let i = 0;
    next = next.replace(
      /(<nav[^>]*(?:fk-tab|aria-label)[^>]*>)([\s\S]*?)(<\/nav>)/i,
      (_, open, inner, close) => {
        const replaced = inner.replace(/<svg[\s\S]*?<\/svg>/gi, () => {
          const svg = svgs[Math.min(i, svgs.length - 1)];
          i += 1;
          return String(svg).replace("<svg", "<svg width='24' height='24'");
        });
        return `${open}${replaced}${close}`;
      },
    );
  }
  return next;
}

async function openPage(html) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return null;
  }
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 12000 });
  try {
    await page.waitForSelector("[data-fenix-ready]", { timeout: 4000, state: "attached" });
  } catch {
    await new Promise((r) => setTimeout(r, 280));
  }
  return { browser, page };
}

async function shotTab(page, index) {
  try {
    const buttons = page.locator("nav button, .fk-tab button, .tabbar button");
    const n = await buttons.count();
    if (n > index) {
      await buttons.nth(index).click({ timeout: 2500 });
      await new Promise((r) => setTimeout(r, 320));
    }
  } catch {
    /* tab non cliccabile */
  }
  const buf = await page.screenshot({ type: "jpeg", quality: 58 });
  return Buffer.from(buf).toString("base64");
}

async function auditTab(page, index) {
  try {
    const buttons = page.locator("nav button, .fk-tab button, .tabbar button");
    const n = await buttons.count();
    if (n > index) {
      await buttons.nth(index).click({ timeout: 2500 });
      await new Promise((r) => setTimeout(r, 280));
    }
  } catch {
    /* ignore */
  }
  return page.evaluate(() => {
    const main = document.querySelector("main");
    const text = ((main && main.innerText) || "").replace(/\s+/g, " ").trim();
    return {
      chars: text.length,
      forms: document.querySelectorAll("form").length,
      tiles: document.querySelectorAll(".fk-tile, .fk-stat, .fk-panel, li, .fk-btn").length,
      empty: text.length < 48,
    };
  });
}

async function polish(prompt, html, instruction) {
  const apiKey = (process.env.XAI_API_KEY || "").trim();
  if (!apiKey) throw new Error("Manca XAI_API_KEY");
  const log = [];
  let current = html;
  let meta = {};
  const tsx = {};
  try {
    if (instruction) {
      log.push("Modifica: salto icone, sistemo solo la tab");
    } else {
      log.push("Disegno icone");
      const pack = await designIcons(apiKey, prompt);
      if (pack) {
        current = injectIcons(current, pack);
        log.push(`Icone ok (${pack.tabs.length} tab)`);
      } else {
        log.push("Icone: JSON non valido, continuo");
      }
    }
  } catch (err) {
    log.push(`Icone saltate: ${err instanceof Error ? err.message : "errore"}`);
  }
  let session = null;
  try {
    session = await openPage(current);
  } catch (err) {
    log.push(`Browser: ${err instanceof Error ? err.message : "errore"}`);
  }
  const focus = instruction ? inferTab(instruction) : -1;
  const rounds = instruction ? 2 : PASSES;
  for (let i = 0; i < rounds; i++) {
    const tabIndex = focus >= 0 ? focus : i;
    const tabId = TAB_IDS[tabIndex] || "home";
    log.push(instruction ? `Modifica tab ${tabId} (${i + 1}/${rounds})` : `Giro ${i + 1}/${PASSES} (schermata ${tabId})`);
    let shot = null;
    try {
      if (session?.page) {
        await session.page.setContent(current, { waitUntil: "domcontentloaded", timeout: 12000 });
        await new Promise((r) => setTimeout(r, 220));
        shot = await shotTab(session.page, tabIndex);
        log.push(`Screenshot tab ${tabId}`);
      } else {
        log.push(`Niente browser, giro ${tabId} a testo`);
      }
    } catch (err) {
      log.push(`Screenshot fallito: ${err instanceof Error ? err.message : "errore"}`);
    }
    try {
      const text = await grok(apiKey, prompt, current, shot, tabIndex + 1, instruction, tabId);
      const screen = parseScreen(text);
      if (screen?.inner) {
        current = spliceScreen(current, screen.id || tabId, screen.inner);
        const id = screen.id || tabId;
        const comp = TSX_NAME[id] || "Home";
        tsx[comp] = htmlToJsx(screen.inner, comp);
        log.push(`Patch solo tab ${id} + src/screens/${comp}.tsx`);
      } else {
        const parsed = parseHtml(text);
        if (parsed?.html) {
          current = keepScripts(current, parsed.html);
          meta = parsed.meta;
          log.push(`Patch ${tabId} file intero (fallback, JS conservato)`);
        } else {
          log.push(`Patch ${tabId} ignorata`);
        }
      }
    } catch (err) {
      log.push(`Giro ${tabId} saltato: ${err instanceof Error ? err.message : "xAI"}`);
    }
  }
  if (!instruction && session?.page) {
    const started = Date.now();
    for (let extra = 0; extra < 5 && Date.now() - started < 7 * 60 * 1000; extra++) {
      try {
        await session.page.setContent(current, { waitUntil: "domcontentloaded", timeout: 12000 });
        await new Promise((r) => setTimeout(r, 200));
        let weak = -1;
        for (let t = 0; t < TAB_IDS.length; t++) {
          const a = await auditTab(session.page, t);
          if (a.empty) {
            weak = t;
            break;
          }
        }
        if (weak < 0) {
          log.push("Checklist: 5 tab piene. Stop.");
          break;
        }
        const tabId = TAB_IDS[weak];
        log.push(`Riprovo tab vuota ${tabId} (extra ${extra + 1})`);
        const shot = await shotTab(session.page, weak);
        const text = await grok(apiKey, prompt, current, shot, weak + 1, instruction, tabId);
        const screen = parseScreen(text);
        if (screen?.inner) {
          current = spliceScreen(current, screen.id || tabId, screen.inner);
          const id = screen.id || tabId;
          const comp = TSX_NAME[id] || "Home";
          tsx[comp] = htmlToJsx(screen.inner, comp);
          log.push(`Patch extra ${id} + src/screens/${comp}.tsx`);
        } else {
          log.push(`Extra ${tabId} senza patch`);
        }
      } catch (err) {
        log.push(`Extra saltato: ${err instanceof Error ? err.message : "errore"}`);
      }
    }
  }
  if (session?.browser) {
    try {
      await session.browser.close();
    } catch {
      /* ignore */
    }
  }
  current = restoreHome(current);
  try {
    const apiKey = (process.env.XAI_API_KEY || "").trim();
    const hero = apiKey
      ? await generateHero(apiKey, prompt, /fk-tab/i.test(current) ? "1:1" : "16:9")
      : null;
    if (hero) {
      current = injectHero(current, hero);
      log.push("Foto hero");
    }
  } catch {
    /* senza foto */
  }
  const files = Object.entries(tsx).map(([comp, content]) => ({
    path: `src/screens/${comp}.tsx`,
    content,
  }));
  if (files.length) log.push(`TSX aggiornati: ${files.map((f) => f.path).join(", ")}`);
  return { html: current, meta, log, files };
}

function scriptsSyntax(html) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html || ""))) {
    const attrs = match[1] || "";
    if (/\bsrc\s*=/i.test(attrs)) continue;
    if (/type\s*=\s*["']?(module|application\/json|importmap)/i.test(attrs)) continue;
    const body = String(match[2] || "").trim();
    if (!body) continue;
    try {
      new Function(body);
    } catch (err) {
      return err instanceof Error ? err.message : "JS non valido";
    }
  }
  if (/\$\{/.test(String(html || "").replace(/<script\b[\s\S]*?<\/script>/gi, " "))) {
    return "Template literal nel markup";
  }
  return "";
}

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

const jobs = new Map();
let queue = Promise.resolve();

function enqueue(fn) {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => {},
    () => {},
  );
  return run;
}

function cors(res) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end();
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    cors(res);
    return;
  }
  const url = req.url || "/";
  if (req.method === "GET" && (url === "/" || url === "/health")) {
    json(res, 200, { ok: true, model: MODEL, passes: PASSES, jobs: jobs.size });
    return;
  }
  if (req.method === "GET" && url.startsWith("/jobs/")) {
    const id = url.slice("/jobs/".length).split("?")[0];
    const job = jobs.get(id);
    if (!job) {
      json(res, 404, { error: "Job non trovato" });
      return;
    }
    json(res, 200, job);
    return;
  }
  if (req.method !== "POST" || !(url.startsWith("/polish") || url.startsWith("/build"))) {
    json(res, 404, { error: "POST /polish o POST /build" });
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  let body = {};
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    json(res, 400, { error: "JSON non valido" });
    return;
  }
  const prompt = String(body.prompt || "").slice(0, 2500);
  const html = String(body.html || "").slice(0, 120000);
  const instruction = String(body.instruction || "").slice(0, 2500);
  const isBuild = url.startsWith("/build");
  if (prompt.length < 3 || (!isBuild && html.length < 80)) {
    json(res, 400, { error: isBuild ? "Serve un brief." : "Servono brief e HTML." });
    return;
  }
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const job = { id, status: "run", log: ["In coda"], html: null, meta: {}, error: null };
  jobs.set(id, job);
  enqueue(async () => {
    job.log = ["Partito"];
    try {
      const result = isBuild
        ? await generate(prompt, html, instruction)
        : await polish(prompt, html, instruction);
      const broken = scriptsSyntax(result.html);
      if (broken) {
        if (isBuild) {
          job.status = "err";
          job.error = `HTML non valido: ${broken}`;
          job.log = [...result.log, job.error];
          return;
        }
        job.status = "ok";
        job.html = html;
        job.meta = result.meta;
        job.log = [...result.log, `Rifinitura scartata (${broken}). Resta la bozza.`];
        job.files = [];
        return;
      }
      job.status = "ok";
      job.html = result.html;
      job.meta = result.meta;
      job.log = result.log;
      job.files = result.files || [];
    } catch (err) {
      job.status = "err";
      job.error = err instanceof Error ? err.message : "Worker visivo fallito";
      job.log = [...job.log, job.error];
    }
    setTimeout(() => jobs.delete(id), 30 * 60 * 1000);
  });
  json(res, 202, { id, status: "run" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Fenix visual worker su :${PORT} — POST /polish /build (coda)`);
});
