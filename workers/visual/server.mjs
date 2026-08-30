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
Legge grafica: iOS / Apple HIG. Sempre, anche se il brief non lo chiede.
- bg #f5f5f7, surface #ffffff, fg #1d1d1f, muted #86868b, accent #0071e3, line #d2d2d7
- font: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui (niente Inter Manrope viola neon)
- tanta aria, titoli grandi tracking stretto, raggio 12–16, tab bar 5 colonne in basso
- card bianche, panel scuro solo se serve un dato, CTA pillola blu
ICONE (giro dedicato, non opzionale):
- Ridisegna TUTTE le SVG: pittogramma del mestiere, path originali, viewBox 0 0 24 24, stroke 1.8 round, fill none tranne .on
- 5 tab = 5 silhouette diverse, si capiscono senza label. Vietato cerchio+lettera, emoji, icone clonate
- Icona app 52px rx 13 in header + rel=icon, 2 colori #1d1d1f / #0071e3
Correggi SOLO chrome/CSS/icone/layout. NON spegnere JS, form, state.
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

async function grok(apiKey, prompt, html, shotB64, pass, instruction) {
  const user = [
    {
      type: "text",
      text: [
        `GIRO ${pass}/${PASSES}. BRIEF:\n${prompt}`,
        instruction ? `MODIFICA DA TENERE:\n${instruction}\nNon disfare questa modifica.` : "",
        `HTML:\n${html.slice(0, 32000)}`,
        pass === PASSES
          ? "ULTIMO GIRO: solo icone. Ridisegna ogni SVG della tab bar e l'icona app. Non toccare il JS. META+HTML."
          : "Stile iOS: #f5f5f7 #ffffff #1d1d1f #0071e3. Tab intere, aria, CTA, icone originali, 390px. Tieni il JS. META+HTML.",
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

async function withBrowser(html) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return null;
  }
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 12000 });
    await new Promise((r) => setTimeout(r, 250));
    const buf = await page.screenshot({ type: "jpeg", quality: 58 });
    return Buffer.from(buf).toString("base64");
  } finally {
    await browser.close();
  }
}

async function polish(prompt, html, instruction) {
  const apiKey = (process.env.XAI_API_KEY || "").trim();
  if (!apiKey) throw new Error("Manca XAI_API_KEY");
  const log = [];
  let current = html;
  let meta = {};
  for (let pass = 1; pass <= PASSES; pass++) {
    log.push(`Giro ${pass}/${PASSES}`);
    let shot = null;
    try {
      shot = await withBrowser(current);
      log.push(shot ? `Screenshot ${pass}` : `Niente browser, giro ${pass} a testo`);
    } catch (err) {
      log.push(`Screenshot fallito: ${err instanceof Error ? err.message : "errore"}`);
    }
    const text = await grok(apiKey, prompt, current, shot, pass, instruction);
    const parsed = parseHtml(text);
    if (parsed?.html) {
      current = parsed.html;
      meta = parsed.meta;
      log.push(`Patch ${pass} ok (${current.length} caratteri)`);
    } else {
      log.push(`Patch ${pass} ignorata`);
    }
  }
  return { html: current, meta, log };
}

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    });
    res.end();
    return;
  }
  if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
    json(res, 200, { ok: true, model: MODEL, passes: PASSES });
    return;
  }
  if (req.method !== "POST" || !req.url?.startsWith("/polish")) {
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
  try {
    const result = await polish(prompt, html, instruction);
    json(res, 200, result);
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : "Worker visivo fallito" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Fenix visual worker su :${PORT} — POST /polish`);
});
