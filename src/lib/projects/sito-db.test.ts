import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { chromium } from "playwright";
import { prepareSrcDoc } from "./color-scheme.ts";
import { APP_DB_KEY } from "./durable-db.ts";
import {
  bindPublishedSiteDb,
  dispatchPublishedSiteCloudDb,
  dispatchPublishedSiteDb,
  parseSiteDbRequest,
  siteDbReplyOrigin,
} from "./sito-db.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");

describe("published /sito Fenix db", () => {
  it("uses cloud-private revisions and distinguishes conflicts from outages", async () => {
    const requests: { url: string; init?: RequestInit; body: Record<string, unknown> }[] = [];
    const replies = [
      { status: 200, body: { ok: true, rev: 4, data: [{ id: "old" }] } },
      { status: 200, body: { ok: true, rev: 5, data: [{ id: "new" }] } },
    ];
    const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
      requests.push({
        url: String(input),
        init,
        body: JSON.parse(String(init?.body || "{}")) as Record<string, unknown>,
      });
      const next = replies.shift();
      assert.ok(next);
      return new Response(JSON.stringify(next.body), {
        status: next.status,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const saved = await dispatchPublishedSiteCloudDb(
      {
        t: "fenix-db",
        id: "r1",
        op: "save",
        projectId: "site-cloud-1",
        col: "items",
        data: [{ id: "new" }],
      },
      "site-cloud-1",
      undefined,
      { fetch: fetcher },
    );
    assert.deepEqual(saved, { state: "ok", rev: 5, data: [{ id: "new" }] });
    assert.equal(requests.length, 2, "a direct save must first learn the current revision");
    assert.deepEqual(requests[0]?.body, { op: "load", col: "items" });
    assert.deepEqual(requests[1]?.body, {
      op: "save",
      col: "items",
      rev: 4,
      data: [{ id: "new" }],
    });
    assert.equal(requests[1]?.url, "/api/app-data/site-cloud-1");
    assert.equal(requests[1]?.init?.credentials, "same-origin");

    const conflictFetch = (async () =>
      new Response(
        JSON.stringify({ conflict: true, current: { rev: 8, data: [{ id: "winner" }] } }),
        { status: 409 },
      )) as typeof fetch;
    assert.deepEqual(
      await dispatchPublishedSiteCloudDb(
        { t: "fenix-db", id: "r2", op: "save", projectId: "site-cloud-1", col: "items", data: [] },
        "site-cloud-1",
        7,
        { fetch: conflictFetch },
      ),
      { state: "conflict", current: { rev: 8, data: [{ id: "winner" }] } },
    );
    const unavailableFetch = (async () =>
      new Response(JSON.stringify({ error: "Dati cloud non configurati." }), {
        status: 503,
      })) as typeof fetch;
    assert.deepEqual(
      await dispatchPublishedSiteCloudDb(
        { t: "fenix-db", id: "r3", op: "load", projectId: "site-cloud-1", col: "items" },
        "site-cloud-1",
        undefined,
        { fetch: unavailableFetch },
      ),
      { state: "unavailable" },
    );
    const rejectedFetch = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    assert.deepEqual(
      await dispatchPublishedSiteCloudDb(
        { t: "fenix-db", id: "r4", op: "load", projectId: "site-cloud-1", col: "items" },
        "site-cloud-1",
        undefined,
        { fetch: rejectedFetch },
      ),
      { state: "unavailable" },
    );
  });

  it("propagates shared role metadata on success and fail-closed writes", async () => {
    const editorFetch = (async () =>
      new Response(
        JSON.stringify({
          ok: true,
          rev: 3,
          data: [{ id: "shared" }],
          mode: "cloud-shared",
          shared: true,
          role: "editor",
        }),
        { status: 200 },
      )) as typeof fetch;
    assert.deepEqual(
      await dispatchPublishedSiteCloudDb(
        { t: "fenix-db", id: "shared-1", op: "load", projectId: "site-1", col: "items" },
        "site-1",
        undefined,
        { fetch: editorFetch },
      ),
      {
        state: "ok",
        rev: 3,
        data: [{ id: "shared" }],
        mode: "cloud-shared",
        role: "editor",
      },
    );

    const viewerFetch = (async () =>
      new Response(
        JSON.stringify({
          error: "Accesso in sola lettura.",
          mode: "cloud-shared",
          shared: true,
          role: "viewer",
        }),
        { status: 403 },
      )) as typeof fetch;
    assert.deepEqual(
      await dispatchPublishedSiteCloudDb(
        {
          t: "fenix-db",
          id: "shared-2",
          op: "save",
          projectId: "site-1",
          col: "items",
          data: [],
        },
        "site-1",
        3,
        { fetch: viewerFetch },
      ),
      { state: "error", mode: "cloud-shared", role: "viewer" },
    );
  });

  it("binds cloud mode to the expected iframe and deduplicates retried request ids", async () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    let listener: ((event: MessageEvent) => void) | undefined;
    const posted: { payload: unknown; origin: string }[] = [];
    const frame = {
      postMessage(payload: unknown, origin: string) {
        posted.push({ payload, origin });
      },
    } as unknown as Window;
    const fakeWindow = {
      addEventListener(type: string, next: (event: MessageEvent) => void) {
        if (type === "message") listener = next;
      },
      removeEventListener(type: string, next: (event: MessageEvent) => void) {
        if (type === "message" && listener === next) listener = undefined;
      },
    } as unknown as Window;
    Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
    let fetchCalls = 0;
    let release: ((value: Response) => void) | undefined;
    const fetcher = (() => {
      fetchCalls += 1;
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    }) as typeof fetch;
    try {
      const unbind = bindPublishedSiteDb(
        "site-cloud-1",
        { current: { contentWindow: frame } as HTMLIFrameElement },
        { fetch: fetcher },
      );
      const event = {
        data: {
          t: "fenix-db",
          id: "same-request",
          op: "load",
          projectId: "site-cloud-1",
          col: "items",
        },
        source: frame,
        origin: "null",
      } as MessageEvent;
      listener?.(event);
      listener?.(event);
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(fetchCalls, 1);
      assert.ok(release);
      release(
        new Response(JSON.stringify({ ok: true, rev: 2, data: [{ id: "cloud" }] }), {
          status: 200,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.deepEqual(posted, [
        {
          origin: "*",
          payload: {
            t: "fenix-db",
            id: "same-request",
            mode: "cloud-private",
            v: [{ id: "cloud" }],
          },
        },
      ]);
      unbind();
      assert.equal(listener, undefined);
    } finally {
      if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });

  it("sito route binds durable db without the project store", () => {
    const sito = readFileSync(join(root, "src/routes/sito.$projectId.tsx"), "utf8");
    const db = readFileSync(join(here, "sito-db.ts"), "utf8");
    assert.match(sito, /bindPublishedSiteDb\(projectId, iframeRef\)/);
    assert.match(sito, /useRef<HTMLIFrameElement>/);
    assert.match(sito, /ref=\{iframeRef\}/);
    assert.doesNotMatch(sito, /useProjectStore/);
    assert.match(db, /readAllDurable/);
    assert.match(db, /writeDurable/);
    assert.match(db, /iframeRef\?\.current\?\.contentWindow/);
    assert.match(db, /event\.source !== expectedSource/);
    assert.match(db, /Opaque srcdoc origin is the string "null"/);
    assert.doesNotMatch(db, /useProjectStore/);
    assert.doesNotMatch(db, /allow-same-origin/);
  });

  it("accepts only load/save from the expected iframe window", () => {
    const iframe = { postMessage() {} } as unknown as Window;
    const evil = { postMessage() {} } as unknown as Window;
    const save = {
      t: "fenix-db",
      id: "req-1",
      op: "save",
      projectId: "p1",
      col: "messages",
      data: [{ name: "Anna" }],
    };
    const ok = dispatchPublishedSiteDb(
      { data: save, source: iframe, origin: "https://fenix.kreluna.it" },
      "p1",
      iframe,
      {},
    );
    assert.equal(ok.replied?.origin, "https://fenix.kreluna.it");
    assert.equal(ok.replied?.source, iframe);
    assert.deepEqual((ok.db.p1?.messages as { name: string }[])[0], { name: "Anna" });

    const hack = dispatchPublishedSiteDb(
      {
        data: { ...save, id: "req-2", data: [{ name: "HACK" }] },
        source: evil,
        origin: "https://evil.example",
      },
      "p1",
      iframe,
      ok.db,
    );
    assert.equal(hack.replied, null);
    assert.deepEqual((hack.db.p1?.messages as { name: string }[])[0], { name: "Anna" });

    assert.equal(parseSiteDbRequest({ ...save, op: "wipe" }, "p1"), null);
    assert.equal(parseSiteDbRequest({ ...save, col: "../x" }, "p1"), null);
    assert.equal(parseSiteDbRequest({ ...save, projectId: "other" }, "p1"), null);
    assert.equal(siteDbReplyOrigin("null"), "*");
    assert.equal(bindPublishedSiteDb("p1", { current: null }) instanceof Function, true);
  });

  it("parent officina-appdb keeps a contact message after iframe remount", async () => {
    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"/><title>Bottega</title></head>
<body>
<nav><a href="#visita">Visita</a></nav>
<main>
<section id="home"><h1>Bottega</h1></section>
<section id="visita">
<form id="contact-form">
<label for="name">Nome</label>
<input type="text" id="name" required>
<label for="email">Email</label>
<input type="email" id="email" required>
<label for="message">Messaggio</label>
<textarea id="message" required></textarea>
<button type="submit">Invia messaggio</button>
</form>
<ul id="messages-list"></ul>
</section>
</main>
<footer>via</footer>
<script>
async function init() {
  const form = document.getElementById("contact-form");
  const list = document.getElementById("messages-list");
  let messages = [];
  try {
    const loaded = await window.Fenix.load("messages");
    if (Array.isArray(loaded)) messages = loaded;
  } catch (e) {}
  function render() {
    list.innerHTML = "";
    if (!messages.length) {
      const li = document.createElement("li");
      li.textContent = "Nessun messaggio ancora.";
      list.appendChild(li);
      return;
    }
    messages.forEach(function (msg) {
      const li = document.createElement("li");
      li.textContent = msg.name + " — " + msg.message;
      list.appendChild(li);
    });
  }
  render();
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const message = document.getElementById("message").value.trim();
    if (!name || !message) return;
    messages.push({ name: name, email: email, message: message, date: new Date().toISOString() });
    try { await window.Fenix.save("messages", messages); } catch (err) {}
    render();
    form.reset();
  });
}
init();
</script>
</body></html>`;
    const src = prepareSrcDoc(html, { bg: "#1a1612", fg: "#e6dcc8" }, "sito-db-demo", "site");
    const parentHtml = `<!DOCTYPE html><html><body>
<iframe id="f" style="width:1100px;height:800px;border:0"></iframe>
<iframe id="evil" style="width:10px;height:10px;border:0"></iframe>
<script>
  window.__evilReplies = 0;
  var iframe = document.getElementById("f");
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || m.t !== "fenix-db" || !m.id || !m.col || !m.projectId) return;
    if (e.source !== iframe.contentWindow) {
      window.__ignoredEvil = (window.__ignoredEvil || 0) + 1;
      return;
    }
    if (m.op !== "load" && m.op !== "save") return;
    var key = ${JSON.stringify(APP_DB_KEY)};
    var db = {};
    try { db = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (err) { db = {}; }
    var cols = db[m.projectId] || {};
    var origin = /^https?:\\/\\//.test(e.origin) ? e.origin : "*";
    if (m.op === "save") {
      cols[m.col] = m.data;
      db[m.projectId] = cols;
      localStorage.setItem(key, JSON.stringify(db));
      e.source.postMessage({ t: "fenix-db", id: m.id, v: m.data }, origin);
      return;
    }
    e.source.postMessage({ t: "fenix-db", id: m.id, v: cols[m.col] || null }, origin);
  });
</script>
</body></html>`;
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage();
      await page.route("http://127.0.0.1/sito-db-harness", async (route) => {
        await route.fulfill({ contentType: "text/html", body: parentHtml });
      });
      await page.goto("http://127.0.0.1/sito-db-harness", { waitUntil: "domcontentloaded" });
      const loadSrc = async () => {
        await page.locator("#f").evaluate((el, srcDoc: string) => {
          (el as HTMLIFrameElement).srcdoc = srcDoc;
        }, src);
      };
      await loadSrc();
      const frame = page.frameLocator("#f");
      await frame.locator("#name").waitFor({ timeout: 8000 });
      await frame.locator("#name").fill("Anna della Luna");
      await frame.locator("#email").fill("anna@bottegaterra.it");
      await frame.locator("#message").fill("Prenoto sabato.");
      await frame.locator("button[type=submit]").click();
      await frame.getByText("Anna della Luna — Prenoto sabato.").waitFor({ timeout: 4000 });
      await loadSrc();
      await frame.getByText("Anna della Luna — Prenoto sabato.").waitFor({ timeout: 8000 });
      const stored = await page.evaluate((key) => localStorage.getItem(key), APP_DB_KEY);
      assert.match(String(stored), /Anna della Luna/);
      await page.locator("#evil").evaluate((el) => {
        (el as HTMLIFrameElement).srcdoc = `<!DOCTYPE html><html><body><script>
window.addEventListener("message", function (e) {
  document.title = "GOT:" + JSON.stringify(e.data);
});
parent.postMessage({
  t: "fenix-db",
  id: "evil-1",
  op: "save",
  projectId: "sito-db-demo",
  col: "messages",
  data: [{ name: "HACK", message: "pwned" }]
}, "*");
</script></body></html>`;
      });
      await page.waitForTimeout(400);
      const afterEvil = await page.evaluate((key) => {
        const w = window as Window & { __ignoredEvil?: number };
        return {
          stored: localStorage.getItem(key),
          ignored: w.__ignoredEvil || 0,
          evilTitle: [...document.querySelectorAll("iframe")].map((f) => {
            try {
              return f.contentDocument?.title || "";
            } catch {
              return "";
            }
          }),
        };
      }, APP_DB_KEY);
      assert.doesNotMatch(String(afterEvil.stored), /HACK/);
      assert.match(String(afterEvil.stored), /Anna della Luna/);
      assert.ok(afterEvil.ignored >= 1, "evil source must be ignored");
      assert.equal(
        afterEvil.evilTitle.some((t) => t.startsWith("GOT:")),
        false,
      );
    } finally {
      await browser.close();
    }
  });

  it("contact messages never execute markup and empty/email stay unpublished", async () => {
    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"/><title>Bottega</title></head>
<body>
<nav aria-label="Sezioni">
<a href="#home" class="logo" aria-label="Bottega Terra"><span class="brand-full">Bottega Terra</span><span class="brand-short">Terra</span></a>
<ul>
<li><a href="#home">Home</a></li>
<li><a href="#bottega">Bottega</a></li>
<li><a href="#lavori">Lavori</a></li>
<li><a href="#visita">Visita</a></li>
</ul>
</nav>
<main>
<section id="home"><h1>Home</h1></section>
<section id="bottega"><h2>Bottega</h2></section>
<section id="lavori"><h2>Lavori</h2></section>
<section id="visita">
<a href="#visita" class="btn">Prenota una visita</a>
<form id="contact-form" novalidate>
<label for="name">Nome</label>
<input type="text" id="name" required>
<label for="email">Email</label>
<input type="email" id="email" required>
<label for="message">Messaggio</label>
<textarea id="message" required></textarea>
<p id="form-error"></p>
<button type="submit">Invia messaggio</button>
</form>
<ul id="messages-list"></ul>
</section>
</main>
<footer>via</footer>
<script>
async function init() {
  const form = document.getElementById("contact-form");
  const list = document.getElementById("messages-list");
  const errEl = document.getElementById("form-error");
  let messages = [];
  try {
    const loaded = await window.Fenix.load("messages");
    if (Array.isArray(loaded)) messages = loaded;
  } catch (e) {}
  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }
  function validEmail(value) {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(value || ""));
  }
  function render() {
    clearNode(list);
    if (!messages.length) {
      const li = document.createElement("li");
      li.textContent = "Nessun messaggio ancora.";
      list.appendChild(li);
      return;
    }
    messages.forEach(function (msg) {
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = String(msg.name || "");
      li.appendChild(strong);
      li.appendChild(document.createTextNode(" — " + String(msg.message || "")));
      list.appendChild(li);
    });
  }
  render();
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const message = document.getElementById("message").value.trim();
    if (!name || !message) { errEl.textContent = "Nome e messaggio sono obbligatori."; return; }
    if (!validEmail(email)) { errEl.textContent = "Indica un’email valida."; return; }
    errEl.textContent = "";
    messages.push({ name: name, email: email, message: message, date: new Date().toISOString() });
    try { await window.Fenix.save("messages", messages); } catch (err) {}
    render();
    form.reset();
  });
}
init();
</script>
</body></html>`;
    const src = prepareSrcDoc(html, { bg: "#1a1612", fg: "#e6dcc8" }, "sito-xss-demo", "site");
    assert.doesNotMatch(src, /li\.innerHTML/);
    const parentHtml = `<!DOCTYPE html><html><body>
<iframe id="f" style="width:1100px;height:800px;border:0"></iframe>
<script>
  var iframe = document.getElementById("f");
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || m.t !== "fenix-db" || !m.id || !m.col || !m.projectId) return;
    if (e.source !== iframe.contentWindow) return;
    if (m.op !== "load" && m.op !== "save") return;
    var key = ${JSON.stringify(APP_DB_KEY)};
    var db = {};
    try { db = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (err) { db = {}; }
    var cols = db[m.projectId] || {};
    var origin = /^https?:\\/\\//.test(e.origin) ? e.origin : "*";
    if (m.op === "save") {
      cols[m.col] = m.data;
      db[m.projectId] = cols;
      localStorage.setItem(key, JSON.stringify(db));
      e.source.postMessage({ t: "fenix-db", id: m.id, v: m.data }, origin);
      return;
    }
    e.source.postMessage({ t: "fenix-db", id: m.id, v: cols[m.col] || null }, origin);
  });
</script>
</body></html>`;
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(String(err)));
      await page.route("http://127.0.0.1/sito-xss-harness", async (route) => {
        await route.fulfill({ contentType: "text/html", body: parentHtml });
      });
      await page.goto("http://127.0.0.1/sito-xss-harness", { waitUntil: "domcontentloaded" });
      const loadSrc = async () => {
        await page.locator("#f").evaluate((el, srcDoc: string) => {
          (el as HTMLIFrameElement).srcdoc = srcDoc;
        }, src);
      };
      await loadSrc();
      const frame = page.frameLocator("#f");
      await frame.locator("#name").waitFor({ timeout: 8000 });
      await frame.locator("button[type=submit]").click();
      await frame.getByText("Nessun messaggio ancora.").waitFor();
      assert.match(await frame.locator("#form-error").innerText(), /obbligatori/i);
      await frame.locator("#name").fill("Anna");
      await frame.locator("#email").fill("not-an-email");
      await frame.locator("#message").fill("Ciao");
      await frame.locator("button[type=submit]").click();
      await frame.getByText("Nessun messaggio ancora.").waitFor();
      assert.match(await frame.locator("#form-error").innerText(), /email/i);
      const payload = `<img src=x onerror="window.__xss=1">`;
      await frame.locator("#name").fill(payload);
      await frame.locator("#email").fill("anna@bottegaterra.it");
      await frame.locator("#message").fill(payload);
      await frame.locator("button[type=submit]").click();
      await frame.getByText(/<img src=x onerror=/).waitFor({ timeout: 8000 });
      const afterXss = await frame.locator("#messages-list").evaluate((ul) => ({
        text: (ul as HTMLElement).innerText,
        imgs: ul.querySelectorAll("img").length,
        html: ul.innerHTML,
        xss: Boolean((window as Window & { __xss?: number }).__xss),
      }));
      assert.match(afterXss.text, /<img src=x onerror=/);
      assert.equal(afterXss.imgs, 0);
      assert.doesNotMatch(afterXss.html, /<img /i);
      assert.equal(afterXss.xss, false);
      await loadSrc();
      await frame.getByText(/<img src=x onerror=/).waitFor({ timeout: 8000 });
      const afterReload = await frame.locator("#messages-list").evaluate((ul) => ({
        text: (ul as HTMLElement).innerText,
        imgs: ul.querySelectorAll("img").length,
      }));
      assert.match(afterReload.text, /<img src=x onerror=/);
      assert.equal(afterReload.imgs, 0);
      for (const id of ["home", "bottega", "lavori", "visita"]) {
        await frame.locator(`nav ul a[href="#${id}"]`).click();
        const top = await frame.locator(`#${id}`).evaluate((el) => el.getBoundingClientRect().top);
        assert.ok(Number.isFinite(top), id);
      }
      await frame.getByRole("link", { name: /Prenota una visita/ }).click();
      assert.equal(errors.length, 0, errors.join(" · "));
    } finally {
      await browser.close();
    }
  });

  it("Bottega brand at 390 is Terra, full aria-label, one row, no ellipsis", async () => {
    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"/><title>Bottega</title>
<style>
.logo,.brand,.brand-full,.brand-short{max-width:none!important;overflow:visible!important;text-overflow:clip!important;white-space:nowrap}
.logo{display:inline-flex;align-items:center;gap:.45rem}
.brand-short{display:none}
@media (max-width:420px){.brand-full{display:none}.brand-short{display:inline}}
nav{display:flex;flex-wrap:nowrap!important;align-items:center;gap:8px}
nav ul{display:flex;flex-wrap:nowrap;margin:0;padding:0;list-style:none}
</style>
</head>
<body>
<header>
<nav aria-label="Sezioni">
<a href="#home" class="logo" aria-label="Bottega Terra">
<span class="brand brand-full">Bottega Terra</span>
<span class="brand brand-short">Terra</span>
</a>
<ul>
<li><a href="#home">Home</a></li>
<li><a href="#bottega">Bottega</a></li>
<li><a href="#lavori">Lavori</a></li>
<li><a href="#visita">Visita</a></li>
</ul>
</nav>
</header>
<main>
<section id="home"><h1>Home</h1></section>
<section id="bottega"></section>
<section id="lavori"></section>
<section id="visita"></section>
</main>
<footer>via</footer>
</body></html>`;
    const src = prepareSrcDoc(html, { bg: "#1a1612", fg: "#e6dcc8" }, "sito-nav-390", "site");
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.setContent(src, { waitUntil: "domcontentloaded" });
      const shot = "/workspace/screenshots/fase1-scorecard/bottega-nav-390.png";
      await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
      const info = await page.evaluate(() => {
        const logo = document.querySelector("a.logo") as HTMLAnchorElement | null;
        const short = document.querySelector(".brand-short") as HTMLElement | null;
        const full = document.querySelector(".brand-full") as HTMLElement | null;
        const links = [...document.querySelectorAll("nav a")].map((a) => {
          const r = (a as HTMLElement).getBoundingClientRect();
          const cs = getComputedStyle(a);
          return {
            t: (a as HTMLElement).innerText.trim(),
            x: r.x,
            y: Math.round(r.y),
            w: r.width,
            overflow: cs.overflow,
            ellipsis: cs.textOverflow,
          };
        });
        const ys = [...new Set(links.map((l) => l.y))];
        return {
          aria: logo?.getAttribute("aria-label") || "",
          short: short?.innerText.trim() || "",
          shortDisplay: short ? getComputedStyle(short).display : "",
          fullDisplay: full ? getComputedStyle(full).display : "",
          navRows: ys.length,
          overflowX: Math.max(
            0,
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
          links,
        };
      });
      assert.equal(info.aria, "Bottega Terra");
      assert.equal(info.short, "Terra");
      assert.notEqual(info.shortDisplay, "none");
      assert.equal(info.fullDisplay, "none");
      assert.equal(info.navRows, 1);
      assert.equal(info.overflowX, 0);
      for (const link of info.links) {
        assert.notEqual(link.ellipsis, "ellipsis", link.t);
        assert.equal(link.t.includes("…"), false, link.t);
        assert.equal(link.t.endsWith("T"), false);
      }
      assert.equal(
        info.links.some((l) => l.t === "Terra" || l.t.includes("Terra")),
        true,
      );
    } finally {
      await browser.close();
    }
  });
});
