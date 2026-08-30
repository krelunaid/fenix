import { createServer } from "node:http";

/**
 * Worker visivo Fenix — 3 giri Playwright 390×844 + Grok 4.6.
 * Env: XAI_API_KEY, PORT (8787).
 * POST /polish  { prompt, html }  →  { html, name, log }
 */
const PORT = Number(process.env.PORT || 8787);
const MODEL = "grok-4.6";
const XAI = "https://api.x.ai/v1/chat/completions";
const PASSES = 3;

const SYSTEM = `Sei il motore visivo di Fenix. Vedi uno screenshot TELEFONO 390×844 e l'HTML.
Legge grafica: app telefono, tab in basso, tanta aria. Palette DAL MESTIERE, non sempre grigio iPhone.
Barbiere: crema + inchiostro + ruggine. Luna park: giallo + inchiostro. Acqua: cloro + terracotta.
Testo --fg su --bg contrasto 4.5:1. Niente grigio su grigio. Niente parole Apple/iOS nel prodotto.
- font: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui (niente Inter Manrope viola neon)
- tanta aria, titoli grandi tracking stretto, raggio 12–16, tab bar 5 colonne in basso
- card bianche, panel scuro solo se serve un dato, CTA pillola blu
ICONE (giro dedicato, non opzionale):
- Ridisegna TUTTE le SVG: pittogramma del mestiere, path originali, viewBox 0 0 24 24, stroke 1.8 round, fill none tranne .on
- 5 tab = 5 silhouette diverse, si capiscono senza label. Vietato cerchio+lettera, emoji, icone clonate
- Icona app 52px rx 13 in header + rel=icon, 2 colori #1d1d1f / #0071e3
Correggi chrome/CSS/icone. Se lo screenshot è BIANCO o main vuoto, RIEMPI la home: metriche, oggetto del mestiere, CTA, form. Non lasciare una pagina bianca.
Copia i tag <script> identici se il JS già fa add/save. Se non c'è contenuto visibile, puoi aggiungere HTML in main.
Canvas: body colonna 100dvh, header.fk-top, main.fk-main, nav.fk-tab.
Non scrivere le parole Apple, iOS, Fenix, Grok nel prodotto.
Rispondi SOLO:
<<<META>>>
{"name":"","tagline":"","kind":"app","direction":"","summary":"","palette":{"bg":"#f5f5f7","surface":"#ffffff","fg":"#1d1d1f","muted":"#86868b","accent":"#0071e3"}}
<<<HTML>>>
<!DOCTYPE html>...completo...
<<<END>>>`;

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

async function grok(apiKey, prompt, html, shotB64, pass, instruction) {
  const user = [
    {
      type: "text",
      text: [
        `GIRO ${pass}/${PASSES}. BRIEF:\n${prompt}`,
        instruction ? `MODIFICA DA TENERE:\n${instruction}\nNon disfare questa modifica.` : "",
        `HTML:\n${html.slice(0, 32000)}`,
        pass === PASSES
          ? "ULTIMO GIRO: questa è un'ALTRA tab. Riempi la schermata se vuota. Tieni JS. META+HTML."
          : `Stai guardando la TAB ${pass} (1=home, 2=form, 3=elenco). Rifai SOLO quella schermata se è vuota o illeggibile. Tieni le altre. META+HTML.`,
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
      reasoning_effort: "low",
      temperature: 0.35,
      max_tokens: 12000,
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
      reasoning_effort: "low",
      temperature: 0.4,
      max_tokens: 2500,
      stream: false,
      messages: [
        {
          role: "system",
          content: `Disegni pittogrammi iOS. SOLO JSON, niente markdown:
{"app":"<svg viewBox='0 0 24 24' fill='none' stroke='#1d1d1f' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'>...</svg>","tabs":[{"id":"home","label":"max8","svg":"<svg viewBox='0 0 24 24' fill='none' stroke='#1d1d1f' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'>...</svg>"},{"id":"new","label":"","svg":""},{"id":"list","label":"","svg":""},{"id":"stats","label":"","svg":""},{"id":"more","label":"","svg":""}]}
Oggetto del brief. 5 silhouette diverse, leggibili a 24px. Niente lettera, emoji, Lucide copiato.`,
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
  const mark = `<span class="fk-appicon" aria-hidden="true" style="width:36px;height:36px;border-radius:9px;background:#1d1d1f;display:inline-grid;place-items:center;flex-shrink:0">${String(pack.app).replace("<svg", "<svg width='20' height='20'")}</span>`;
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
  await new Promise((r) => setTimeout(r, 280));
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

async function polish(prompt, html, instruction) {
  const apiKey = (process.env.XAI_API_KEY || "").trim();
  if (!apiKey) throw new Error("Manca XAI_API_KEY");
  const log = [];
  let current = html;
  let meta = {};
  try {
    log.push("Disegno icone");
    const pack = await designIcons(apiKey, prompt);
    if (pack) {
      current = injectIcons(current, pack);
      log.push(`Icone ok (${pack.tabs.length} tab)`);
    } else {
      log.push("Icone: JSON non valido, continuo");
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
  for (let pass = 1; pass <= PASSES; pass++) {
    log.push(`Giro ${pass}/${PASSES} (schermata ${pass})`);
    let shot = null;
    try {
      if (session?.page) {
        await session.page.setContent(current, { waitUntil: "domcontentloaded", timeout: 12000 });
        await new Promise((r) => setTimeout(r, 220));
        shot = await shotTab(session.page, pass - 1);
        log.push(`Screenshot tab ${pass}`);
      } else {
        log.push(`Niente browser, giro ${pass} a testo`);
      }
    } catch (err) {
      log.push(`Screenshot fallito: ${err instanceof Error ? err.message : "errore"}`);
    }
    try {
      const text = await grok(apiKey, prompt, current, shot, pass, instruction);
      const parsed = parseHtml(text);
      if (parsed?.html) {
        current = keepScripts(current, parsed.html);
        meta = parsed.meta;
        log.push(`Patch ${pass} ok (${current.length} caratteri, JS conservato)`);
      } else {
        log.push(`Patch ${pass} ignorata`);
      }
    } catch (err) {
      log.push(`Giro ${pass} saltato: ${err instanceof Error ? err.message : "xAI"}`);
    }
  }
  if (session?.browser) {
    try {
      await session.browser.close();
    } catch {
      /* ignore */
    }
  }
  return { html: current, meta, log };
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
  if (req.method !== "POST" || !url.startsWith("/polish")) {
    json(res, 404, { error: "POST /polish" });
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
  if (prompt.length < 3 || html.length < 80) {
    json(res, 400, { error: "Servono brief e HTML." });
    return;
  }
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const job = { id, status: "run", log: ["In coda"], html: null, meta: {}, error: null };
  jobs.set(id, job);
  enqueue(async () => {
    job.log = ["Partito"];
    try {
      const result = await polish(prompt, html, instruction);
      job.status = "ok";
      job.html = result.html;
      job.meta = result.meta;
      job.log = result.log;
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
  console.log(`Fenix visual worker su :${PORT} — POST /polish (coda)`);
});
