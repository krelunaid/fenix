import { createServer } from "node:http";
import {
  TAB_IDS,
  applyScreenPatch,
  hasScreenTarget,
  looksLikeCssDump,
  noteAbsent,
  noteSkip,
  resolvePatchTarget,
  shouldPolishTab,
} from "./screen-patch.mjs";

/**
 * Worker visivo Fenix — 5 giri (una tab ciascuno) Playwright + grok-build-0.1.
 * Env: XAI_API_KEY, PORT (8787). Tutte le chiamate xAI usano grok-build-0.1, payload Chat Completions senza extra flags.
 * Planner/evaluator vivono in src/lib/ai/build-contract.ts (statici). Qui niente ruoli extra e niente reasoningEffort.
 * POST /polish  { prompt, html }  →  { html, name, log }
 */
const PORT = Number(process.env.PORT || 8787);
const MODEL = "grok-build-0.1";
const XAI = "https://api.x.ai/v1/chat/completions";
const PASSES = 5;

const SYSTEM = `Sei il motore visivo di Fenix. Vedi uno screenshot TELEFONO 390×844 e l'HTML.
Legge grafica: chrome da prodotto (tab in basso se app), identità DAL BRIEF. Token cromatici del contratto, non beige ripetuto.
Qualità nativa da tasca consentita (tipo, ritmo, profondità, materiali, motion ridotto). Vietato clonare schermate, marchi, SF Symbols o la coppia #f5f5f7+#0071e3.
Testo --fg su --bg contrasto 4.5:1. Niente grigio su grigio. Non firmare il prodotto come Apple.
- font dalla direzione visiva (serif manifesto + sans/mono bottega). Vietato Inter, Manrope, SF Pro come default da clone.
- raggio, aria e CTA dal brief. Vietato card bianche + CTA pillola blu + coppia #f5f5f7+#0071e3.
ICONE (giro dedicato, non opzionale):
- Ridisegna TUTTE le SVG: pittogramma del mestiere, path originali, viewBox 0 0 24 24, stroke 1.8 round, fill none tranne .on
- 4–5 tab = silhouette diverse dal mestiere, si capiscono senza label. Vietato cerchio+lettera, emoji, icone clonate
- Icona app 52px rx 13 in header + rel=icon, 2 colori DELLA PALETTE (mai coppia clone #1d1d1f / #0071e3)
Correggi chrome/CSS/icone. Se lo screenshot è BIANCO, main vuoto o dead zone, RIEMPI la home: registro a righe, oggetto del mestiere, CTA, form, lista. Un'app profumi non è un registro generico.
Se la home è 4 riquadri + «Ultimo» + «Stato», SOSTITUISCILA con il mestiere. Vietato empty state «Nessun elemento» se le righe ci sono.
Copia i tag <script> identici se il JS già fa add/save. Se non c'è contenuto visibile, puoi aggiungere HTML in main.
Collezioni Fenix.data: solo token [A-Za-z0-9._-]{1,80}. Mai spazi, slash, accenti, titoli ("capi vesti").
Canvas: body colonna 100dvh, header.fk-top, main.fk-main, nav.fk-tab.
Non scrivere le parole Fenix, Grok nel prodotto.
Rispondi SOLO con la schermata di QUESTA tab, non l'HTML intero:
<<<SCREEN id="home|new|list|stats|more">>>
<!-- solo il contenuto di main di QUESTA tab: metriche, form o lista. Niente html/body/nav -->
<<<END>>>
Se proprio non puoi, allora META+HTML completo come ultima spiaggia.`;

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
  return applyScreenPatch(html, id, inner).html;
}

function looksPhoneShell(html) {
  return /fk-tab|id=["']t-home["']|id=["']t-new["']/i.test(String(html || ""));
}

function restoreHome(html) {
  const m = html.match(/<template[^>]*id=["']t-home["'][^>]*>([\s\S]*?)<\/template>/i);
  if (!m) return html;
  if (!/<main\b/i.test(html)) return html;
  if (looksLikeCssDump(m[1])) return html;
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
Italiano. Palette dal mestiere, mai la coppia clone #f5f5f7+#0071e3. Testo contrasto AA 4.5:1.
Ogni schermata PIENA (numeri, form o lista). Form che salvano.
Qualità nativa da tasca consentita. Vietato clonare schermate/marchi Apple. Niente Grok, Fenix, Inter, Manrope nel prodotto.
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

const SITE_SYSTEM = `Motore Fenix. Generi un SITO WEB desktop, non un'app telefono, non un gestionale.
Italiano. Palette dal mestiere, mai #f5f5f7+#0071e3. Testo contrasto AA 4.5:1.
Nav in alto, almeno 4 sezioni, footer con via/orari. Hero 16:9 a tutta larghezza.
Desktop-first: h1 clamp(2.5rem, 6vw, 4.6rem), max-width 1120px.
VIETATO: nav.fk-tab, nav.bottom-tab, template t-home, src/screens/*.tsx, 5 tab, fk-appicon, 100dvh colonna telefono, Inter, Manrope, coppia clone #f5f5f7+#0071e3, Fenix, Grok.
window.Fenix.load/save sul form. CSS reale. Google Fonts del mestiere.
Rispondi SOLO:
<<<META>>>
{"name":"","tagline":"","kind":"site","summary":"","palette":{"bg":"#1a1612","surface":"#2a241c","fg":"#e6dcc8","muted":"#9a8f7a","accent":"#c45c26"}}
<<<HTML>>>
<!DOCTYPE html> sito desktop completo
<<<END>>>`;

const DASHBOARD_SYSTEM = `Motore Fenix. Generi un GESTIONALE DESKTOP, non un'app telefono, non una landing.
Italiano. Palette dal mestiere, mai #f5f5f7+#0071e3. Testo contrasto AA 4.5:1.
Header in alto o sidebar. Tab in alto — MAI nav.fk-tab in basso, MAI class fk-tab.
Elenco/tabella, filtri, form nuovo, numeri. Almeno 3 viste data-view.
window.Fenix.load/save, mai localStorage. CSS reale, niente controlli browser nudi.
Qualità nativa da tasca consentita. Vietato clonare schermate/marchi Apple. Niente Grok, Fenix, Inter, Manrope nel prodotto.
Rispondi SOLO:
<<<META>>>
{"name":"","tagline":"","kind":"dashboard","summary":"","palette":{"bg":"#1a1612","surface":"#2a241c","fg":"#e6dcc8","muted":"#9a8f7a","accent":"#c45c26"}}
<<<HTML>>>
<!DOCTYPE html> gestionale desktop completo
<<<END>>>`;

function looksDashboard(prompt, instruction, kind) {
  const k = String(kind || "").toLowerCase();
  if (k === "dashboard") return true;
  if (k) return false;
  const p = `${prompt || ""} ${instruction || ""}`.toLowerCase();
  return (
    /\bkind\s*=\s*dashboard\b/.test(p) ||
    /formato:\s*gestionale/.test(p) ||
    /\bgestionale desktop\b/.test(p)
  );
}

function looksSite(prompt, instruction, kind, html) {
  const k = String(kind || "").toLowerCase();
  if (k === "site" || k === "landing") return true;
  if (k) return false;
  const p = `${prompt || ""} ${instruction || ""}`.toLowerCase();
  if (
    /\bkind\s*=\s*site\b/.test(p) ||
    /\bkind\s*=\s*landing\b/.test(p) ||
    /formato:\s*sito/.test(p) ||
    /\bsito web\b/.test(p)
  ) {
    return true;
  }
  const h = String(html || "");
  if (!h || looksPhoneShell(h)) return false;
  const sections = (h.match(/<section\b/gi) || []).length;
  return /<nav\b/i.test(h) && sections >= 3 && /<footer\b/i.test(h);
}

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
        prompt: `Photorealistic close-up of the craft itself (clay, kiln, tools, hands, vessels). No text, no logo, no watermark, no website, no UI, no screenshot, no browser chrome, no navbar, no form, no page collage. Subject: ${String(prompt).slice(0, 280)}`,
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
  if (!/^https:\/\//i.test(url) && !/^data:image\//i.test(url)) return html;
  if (/["<>]/.test(url)) return html;
  const phone = /fk-tab|bottom-tab/i.test(html);
  if (!phone && /^data:image\//i.test(url)) return injectCraftHero(html);
  const img = phone
    ? `<img class="fk-hero" src="${url}" alt="" width="400" height="400" style="width:100%;height:140px;object-fit:cover;border-radius:20px;display:block;margin:8px 0 12px" onerror="this.removeAttribute('src')"/>`
    : `<img class="fk-hero" src="${url}" alt="" width="1600" height="900" style="width:100%;height:min(52vh,560px);min-height:280px;object-fit:cover;display:block" onerror="this.removeAttribute('src')"/>`;
  return placeHeroMarkup(html, img);
}

const CRAFT_HERO_SRC = "/craft-hero.jpg";
const CRAFT_HERO_MARKUP = `<img class="fk-hero fk-hero-craft" src="${CRAFT_HERO_SRC}" alt="Ceramiche in terracotta al tornio" width="1600" height="900" style="width:100%;height:min(52vh,560px);min-height:280px;object-fit:cover;display:block;background:#cbb392"/>`;

function placeHeroMarkup(html, markup) {
  let next = String(html || "").replace(/^\s*"\s*\/>/m, "").replace(/>\s*"\s*\/>/g, ">");
  if (/<svg[^>]*fk-hero[^>]*>[\s\S]*?<\/svg>/i.test(next)) {
    return next.replace(/<svg[^>]*fk-hero[^>]*>[\s\S]*?<\/svg>/i, markup);
  }
  if (/<img[^>]*fk-hero[^>]*>/i.test(next)) {
    return next.replace(/<img[^>]*fk-hero[^>]*>/i, markup);
  }
  if (/<img\b/i.test(next)) return next.replace(/<img\b[^>]*>/i, markup);
  if (/<main\b[^>]*>/i.test(next)) return next.replace(/<main\b[^>]*>/i, (open) => `${open}${markup}`);
  return next;
}

function injectCraftHero(html) {
  if (!html) return html;
  return placeHeroMarkup(html, CRAFT_HERO_MARKUP);
}

function scrubCraftMedia(html) {
  if (!html) return html;
  let next = String(html);
  const gallery = ["/craft-shelf.jpg", "/craft-vase.jpg", "/craft-bowl.jpg", "/craft-plate.jpg", "/craft-pitcher.jpg"];
  let gi = 0;
  next = next.replace(/https:\/\/images\.unsplash\.com\/[^"'>\s]+/gi, () => gallery[gi++ % gallery.length]);
  if (/fk-tab|bottom-tab/i.test(next)) return next;
  next = next.replace(/<img\b([^>]*class=["'][^"']*fk-hero[^"']*["'][^>]*)>/gi, (tag, attrs) => {
    const src = String(attrs).match(/\bsrc=["']([^"']*)["']/i)?.[1] || "";
    if (src === CRAFT_HERO_SRC || /\/craft-hero\.jpg(?:\?|$)/.test(src)) return CRAFT_HERO_MARKUP;
    if (/\bfk-hero-craft\b/.test(tag) || !src || /^data:image\//i.test(src)) return CRAFT_HERO_MARKUP;
    return tag;
  });
  next = next.replace(/<svg[^>]*fk-hero[^>]*>[\s\S]*?<\/svg>/gi, CRAFT_HERO_MARKUP);
  gi = 0;
  next = next.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\bfk-hero/.test(tag)) return tag;
    if (!/\/craft-hero\.jpg/.test(tag)) return tag;
    const src = gallery[gi++ % gallery.length];
    return tag.replace(/src=(["'])[^"']*\/craft-hero\.jpg[^"']*\1/i, `src=$1${src}$1`);
  });
  return next;
}

const HERO_MAX_BYTES = 900_000;

async function materializeHero(url) {
  const src = String(url || "").trim();
  if (/^data:image\/(jpeg|jpg|png|webp|gif|avif)/i.test(src)) return src;
  if (!/^https:\/\//i.test(src)) return null;
  try {
    const res = await fetch(src, { redirect: "follow" });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!/^image\/(jpeg|jpg|png|webp|gif|avif)$/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > HERO_MAX_BYTES) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function placeHero(html, prompt) {
  if (!html) return { html, log: [] };
  const phone = /fk-tab/i.test(html);
  if (!phone) {
    return { html: scrubCraftMedia(injectCraftHero(html)), log: ["Hero mestiere"] };
  }
  const apiKey = (process.env.XAI_API_KEY || "").trim();
  if (!apiKey) return { html: scrubCraftMedia(html), log: [] };
  const remote = await generateHero(apiKey, prompt, "1:1");
  if (!remote) return { html: scrubCraftMedia(html), log: [] };
  const durable = await materializeHero(remote);
  if (!durable) return { html: scrubCraftMedia(html), log: [] };
  return { html: scrubCraftMedia(injectHero(html, durable)), log: ["Foto hero"] };
}

function stripPhoneChromeFromSite(html) {
  if (!html) return html;
  let next = html;
  const stripBottom = (s) =>
    s.replace(/<nav[^>]*class=["'][^"']*bottom-tab[^"']*["'][^>]*>[\s\S]*?<\/nav>/gi, "");
  const stripFk = (s) =>
    s.replace(/<nav[^>]*class=["'][^"']*fk-tab[^"']*["'][^>]*>[\s\S]*?<\/nav>/gi, "");
  const afterBottom = stripBottom(next);
  const afterBoth = stripFk(afterBottom);
  if (/<nav\b/i.test(afterBoth)) next = afterBoth;
  else if (/<nav\b/i.test(afterBottom)) next = afterBottom;
  next = next.replace(/<span[^>]*class=["'][^"']*fk-appicon[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, "");
  next = next.replace(/\.bottom-tab\s*\{[^}]*\}/g, "");
  next = next.replace(/html,\s*body\s*\{([^}]*)\}/i, (_m, body) => {
    const cleaned = String(body)
      .replace(/height:\s*100dvh\s*;?/i, "")
      .replace(/display:\s*flex\s*;?/i, "")
      .replace(/flex-direction:\s*column\s*;?/i, "");
    return `html, body {${cleaned}}`;
  });
  next = next.replace(/main\s*\{([^}]*)\}/i, (m, body) => {
    if (!/flex:\s*1/.test(body)) return m;
    const cleaned = String(body)
      .replace(/flex:\s*1\s*;?/i, "")
      .replace(/overflow:\s*auto\s*;?/i, "");
    return `main {${cleaned}}`;
  });
  if (/getElementById\(['"]main['"]\)/.test(next) && !/<main\b[^>]*\bid\s*=/i.test(next) && /<main\b/i.test(next)) {
    next = next.replace(/<main\b/i, '<main id="main"');
  }
  return next;
}

async function generate(prompt, html, instruction, kind) {
  const apiKey = (process.env.XAI_API_KEY || "").trim();
  if (!apiKey) throw new Error("Manca XAI_API_KEY");
  const dashboard = looksDashboard(prompt, instruction, kind);
  const site = looksSite(prompt, instruction, kind, html);
  const user = [
    `BRIEF:\n${prompt}`,
    html ? `HTML ATTUALE:\n${html.slice(0, 20000)}` : "",
    instruction ? `MODIFICA:\n${instruction}` : "",
    dashboard
      ? "META kind=dashboard + HTML gestionale desktop completo ora. Niente nav.fk-tab."
      : site
        ? "META kind=site + HTML sito desktop completo ora. Nav in alto, niente tabbar, niente TSX, niente 5 tab."
        : "META + HTML completo ora.",
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
        { role: "system", content: dashboard ? DASHBOARD_SYSTEM : site ? SITE_SYSTEM : GENERATE_SYSTEM },
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
    if (sm && !dashboard && !site) {
      out = spliceScreen(out, sm[1], content);
      const comp = TSX_NAME[sm[1]];
      if (comp) fromGrok.push({ path: `src/screens/${comp}.tsx`, content: htmlToJsx(content, comp) });
    }
  }
  let usedHero = false;
  if (site) {
    out = injectCraftHero(out);
    usedHero = true;
  } else {
    const hero = await generateHero(apiKey, prompt, /fk-tab|bottom-tab/i.test(out) ? "1:1" : "16:9");
    if (hero) {
      const durable = await materializeHero(hero);
      if (durable) {
        out = injectHero(out, durable);
        usedHero = true;
      }
    }
  }
  if (!dashboard && site) {
    out = stripPhoneChromeFromSite(out);
  }
  out = scrubCraftMedia(out);
  const meta = dashboard ? { ...(parsed.meta || {}), kind: "dashboard" } : parsed.meta;
  return {
    html: out,
    meta: site ? { ...(meta || {}), kind: "site" } : meta,
    log: dashboard
      ? usedHero
        ? ["Bozza gestionale desktop", "Foto hero"]
        : ["Bozza gestionale desktop"]
      : site
        ? ["Bozza sito", "Hero mestiere"]
        : usedHero
          ? ["Bozza 5 schermate", "Foto hero"]
          : ["Bozza 5 schermate"],
    files: site ? [] : fromGrok,
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

const CRAFT_TAB_ICONS = [
  {
    id: "home",
    label: "Home",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h11.5v17H6z"/><path d="M9 3.5v17"/><path d="M12 8h4.2M12 12h4.2M12 16h3"/></svg>`,
  },
  {
    id: "new",
    label: "Nuovo",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3.5 20.5 10 11 19.5H5.5V14z"/><path d="M13 4.5l6.5 6.5"/><path d="M8 13.5l3 3"/></svg>`,
  },
  {
    id: "list",
    label: "Elenco",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12v13H8z"/><path d="M5 4h12"/><path d="M5 4v12"/><path d="M11 10.5h6M11 14h5"/></svg>`,
  },
  {
    id: "stats",
    label: "Numeri",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5v14M10 5v14M14 5v14M18 5v14"/><path d="M5 9.5l14 5"/></svg>`,
  },
  {
    id: "more",
    label: "Altro",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3.5" width="12" height="10" rx="1.2"/><path d="M9 13.5v4.5M15 13.5v4.5M8 20h8"/></svg>`,
  },
];
const CRAFT_APP_ICON = CRAFT_TAB_ICONS[0].svg;

function isAppleChromeSvg(svg) {
  const s = String(svg || "");
  return [
    /M4 10\.5[\s,]12 4l8 6\.5V20H4/,
    /M12 8v8M8 12h8/,
    /M5 7h14M5 12h14M5 17h10/,
    /M5 20V10M12 20V4M19 20v-7/,
    /M5 20c1\.5-4[\s,]12\.5-4[\s,]14 0/,
    /<circle[^>]*cy=["']7["'][^>]*r=["']3["']/,
    /<circle[^>]*cx=["']12["'][^>]*cy=["']12["'][^>]*r=["']8["']/,
  ].some((re) => re.test(s));
}

function sanitizeIconPack(pack) {
  const fallback = { app: CRAFT_APP_ICON, tabs: CRAFT_TAB_ICONS };
  if (!pack || !Array.isArray(pack.tabs)) return fallback;
  const tabs = CRAFT_TAB_ICONS.map((base, i) => {
    const t = pack.tabs[i] || pack.tabs.find((x) => x?.id === base.id);
    if (t?.svg && /<svg/i.test(t.svg) && !isAppleChromeSvg(t.svg)) {
      return { id: base.id, label: String(t.label || base.label).slice(0, 8), svg: t.svg };
    }
    return base;
  });
  const app = pack.app && /<svg/i.test(pack.app) && !isAppleChromeSvg(pack.app) ? pack.app : fallback.app;
  return { app, tabs };
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
Oggetto del brief. 5 silhouette diverse, leggibili a 24px.
VIETATO: casetta, plus in cerchio, omino, hamburger, barre iPhone, Lucide copiato, lettera, emoji.
Per un taccuino: quaderno, pennino, fogli, tallies, timbro. Stroke currentColor, mai #1d1d1f/#0071e3.`,
        },
        { role: "user", content: `BRIEF:\n${prompt}\n\nJSON icone.` },
      ],
    }),
  });
  if (!res.ok) return sanitizeIconPack(null);
  const payload = await res.json();
  const text = payload.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return sanitizeIconPack(null);
  try {
    const pack = JSON.parse(match[0]);
    return sanitizeIconPack(pack);
  } catch {
    return sanitizeIconPack(null);
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
  const nav = next.match(/<nav[^>]*(?:fk-tab|aria-label)[^>]*>[\s\S]*?<\/nav>/i)?.[0] || "";
  if (isAppleChromeSvg(nav)) {
    let j = 0;
    next = next.replace(
      /(<nav[^>]*(?:fk-tab|aria-label)[^>]*>)([\s\S]*?)(<\/nav>)/i,
      (_, open, inner, close) => {
        const replaced = inner.replace(/<svg[\s\S]*?<\/svg>/gi, () => {
          const icon = CRAFT_TAB_ICONS[Math.min(j, CRAFT_TAB_ICONS.length - 1)];
          j += 1;
          return icon.svg.replace("<svg", "<svg width='24' height='24'");
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

async function polish(prompt, html, instruction, kind) {
  const apiKey = (process.env.XAI_API_KEY || "").trim();
  if (!apiKey) throw new Error("Manca XAI_API_KEY");
  if (looksDashboard(prompt, instruction, kind)) {
    const dashInstruction =
      instruction ||
      "SOSTITUISCI nav.fk-tab e lo scheletro telefono con un gestionale desktop. Header o sidebar, tabella, filtri, form, numeri. kind=dashboard. Niente tabbar iPhone. Tieni Fenix.load/save. CSS reale.";
    const result = await generate(prompt, html, dashInstruction, kind);
    return {
      ...result,
      meta: { ...(result.meta || {}), kind: "dashboard" },
      log: ["Rifinitura gestionale desktop", ...(result.log || [])],
    };
  }
  if (looksSite(prompt, instruction, kind, html)) {
    const log = ["Rifinitura sito (nav in alto, niente tabbar)"];
    let current = html;
    if (looksPhoneShell(html) || /bottom-tab|fk-appicon|height:\s*100dvh/i.test(html)) {
      const regen = await generate(
        prompt,
        html,
        instruction || "FORMATO: sito web. kind=site. Rigenera desktop, nav in alto, niente tabbar.",
        kind || "site",
      );
      current = regen.html;
      log.push(...(regen.log || []), "Layout desktop");
    }
    current = stripPhoneChromeFromSite(current);
    try {
      const placed = await placeHero(current, prompt);
      current = placed.html;
      log.push(...placed.log);
    } catch {
      /* senza foto */
    }
    current = stripPhoneChromeFromSite(current);
    return { html: current, meta: { kind: "site" }, log, files: [] };
  }
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
  const phone = looksPhoneShell(current);
  const focus = instruction ? inferTab(instruction) : -1;
  const rounds = !phone ? 0 : instruction ? 2 : PASSES;
  const absent = new Set();
  const skipSeen = new Set();
  for (let i = 0; i < rounds; i++) {
    const tabIndex = focus >= 0 ? focus : i;
    const tabId = TAB_IDS[tabIndex] || "home";
    if (!shouldPolishTab(current, tabId, absent)) {
      noteAbsent(absent, log, tabId, false);
      continue;
    }
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
        const id = resolvePatchTarget(current, tabId, screen.id);
        if (!hasScreenTarget(current, id)) {
          noteAbsent(absent, log, id, false);
        } else {
          const patch = applyScreenPatch(current, id, screen.inner);
          if (!patch.applied) {
            if (patch.reason === "absent") noteAbsent(absent, log, patch.id || id, false);
            else noteSkip(skipSeen, log, patch.id || id, patch.reason, false);
          } else {
            current = patch.html;
            const comp = TSX_NAME[id] || "Home";
            tsx[comp] = htmlToJsx(screen.inner, comp);
            log.push(`Patch solo tab ${id} + src/screens/${comp}.tsx`);
          }
        }
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
  if (!instruction && phone && session?.page) {
    const started = Date.now();
    const extraTried = new Set();
    for (let extra = 0; extra < TAB_IDS.length && Date.now() - started < 7 * 60 * 1000; extra++) {
      try {
        await session.page.setContent(current, { waitUntil: "domcontentloaded", timeout: 12000 });
        await new Promise((r) => setTimeout(r, 200));
        let weak = -1;
        for (let t = 0; t < TAB_IDS.length; t++) {
          const tabId = TAB_IDS[t];
          if (!shouldPolishTab(current, tabId, absent, extraTried)) {
            if (!hasScreenTarget(current, tabId)) noteAbsent(absent, log, tabId, true);
            continue;
          }
          const a = await auditTab(session.page, t);
          if (a.empty) {
            weak = t;
            break;
          }
        }
        if (weak < 0) {
          log.push(absent.size ? `Stop patch: ${absent.size} nodi assenti, niente altri tab vuoti` : "Checklist: 5 tab piene. Stop.");
          break;
        }
        const tabId = TAB_IDS[weak];
        extraTried.add(tabId);
        log.push(`Riprovo tab vuota ${tabId} (extra ${extraTried.size})`);
        const shot = await shotTab(session.page, weak);
        const text = await grok(apiKey, prompt, current, shot, weak + 1, instruction, tabId);
        const screen = parseScreen(text);
        if (screen?.inner) {
          const id = resolvePatchTarget(current, tabId, screen.id);
          if (!hasScreenTarget(current, id)) {
            noteAbsent(absent, log, id, true);
          } else {
            const patch = applyScreenPatch(current, id, screen.inner);
            if (!patch.applied) {
              if (patch.reason === "absent") noteAbsent(absent, log, patch.id || id, true);
              else noteSkip(skipSeen, log, patch.id || id, patch.reason, true);
            } else {
              current = patch.html;
              const comp = TSX_NAME[id] || "Home";
              tsx[comp] = htmlToJsx(screen.inner, comp);
              log.push(`Patch extra ${id} + src/screens/${comp}.tsx`);
            }
          }
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
    const placed = await placeHero(current, prompt);
    current = placed.html;
    log.push(...placed.log);
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
    "Access-Control-Allow-Headers": "content-type, idempotency-key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

const jobs = new Map();
const jobsByKey = new Map();
const activeByProject = new Map();
let queue = Promise.resolve();

function enqueue(fn) {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => {},
    () => {},
  );
  return run;
}

function findReusableJob(projectId, key) {
  if (key) {
    const byKey = jobsByKey.get(key);
    if (byKey && byKey.status === "run") return byKey;
  }
  if (projectId) {
    const id = activeByProject.get(projectId);
    const job = id ? jobs.get(id) : null;
    if (job && job.status === "run") return job;
  }
  return null;
}

function cors(res) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, idempotency-key",
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
    json(res, 200, {
      ok: true,
      model: MODEL,
      passes: PASSES,
      jobs: [...jobs.values()].filter((j) => j.status === "run").length,
    });
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
  const kind = String(body.kind || "").slice(0, 32).toLowerCase();
  const projectId = String(body.projectId || "").slice(0, 80);
  const idempotencyKey = String(
    body.jobId || body.idempotencyKey || req.headers["idempotency-key"] || "",
  ).slice(0, 80);
  const isBuild = url.startsWith("/build");
  if (prompt.length < 3 || (!isBuild && html.length < 80)) {
    json(res, 400, { error: isBuild ? "Serve un brief." : "Servono brief e HTML." });
    return;
  }
  const reusable = findReusableJob(projectId, idempotencyKey);
  if (reusable) {
    json(res, 202, { id: reusable.id, status: reusable.status || "run", reused: true });
    return;
  }
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    projectId: projectId || null,
    status: "run",
    log: ["In coda"],
    html: null,
    meta: {},
    error: null,
  };
  jobs.set(id, job);
  if (idempotencyKey) jobsByKey.set(idempotencyKey, job);
  if (projectId) activeByProject.set(projectId, id);
  enqueue(async () => {
    job.log = ["Partito", "grok-build-0.1 · ruoli visivo/codice · repair max 2"];
    try {
      const result = isBuild
        ? await generate(prompt, html, instruction, kind)
        : await polish(prompt, html, instruction, kind);
      const broken = scriptsSyntax(result.html);
      if (broken) {
        if (isBuild) {
          job.status = "err";
          job.error = `HTML non valido: ${broken}`;
          job.log = [...result.log, job.error];
          if (projectId && activeByProject.get(projectId) === id) activeByProject.delete(projectId);
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
      if (projectId && activeByProject.get(projectId) === id) activeByProject.delete(projectId);
    }
    setTimeout(() => {
      jobs.delete(id);
      if (projectId && activeByProject.get(projectId) === id) activeByProject.delete(projectId);
    }, 30 * 60 * 1000);
  });
  json(res, 202, { id, status: "run" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Fenix visual worker su :${PORT} — POST /polish /build (coda)`);
});
