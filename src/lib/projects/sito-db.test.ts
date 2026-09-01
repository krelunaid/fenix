import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { chromium } from "playwright";
import { prepareSrcDoc } from "./color-scheme.ts";
import { APP_DB_KEY } from "./durable-db.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");

describe("published /sito Fenix db", () => {
  it("sito route binds durable db without the project store", () => {
    const sito = readFileSync(join(root, "src/routes/sito.$projectId.tsx"), "utf8");
    const db = readFileSync(join(here, "sito-db.ts"), "utf8");
    assert.match(sito, /bindPublishedSiteDb/);
    assert.doesNotMatch(sito, /useProjectStore/);
    assert.match(db, /readAllDurable/);
    assert.match(db, /writeDurable/);
    assert.doesNotMatch(db, /useProjectStore/);
    assert.doesNotMatch(db, /allow-same-origin/);
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
<script>
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || m.t !== "fenix-db" || !m.id || !m.col || !m.projectId) return;
    var key = ${JSON.stringify(APP_DB_KEY)};
    var db = {};
    try { db = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (err) { db = {}; }
    var cols = db[m.projectId] || {};
    if (m.op === "save") {
      cols[m.col] = m.data;
      db[m.projectId] = cols;
      localStorage.setItem(key, JSON.stringify(db));
      e.source.postMessage({ t: "fenix-db", id: m.id, v: m.data }, "*");
      return;
    }
    e.source.postMessage({ t: "fenix-db", id: m.id, v: cols[m.col] || null }, "*");
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
        await page.locator("#f").evaluate((el, srcDoc) => {
          el.srcdoc = srcDoc;
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
    } finally {
      await browser.close();
    }
  });
});
