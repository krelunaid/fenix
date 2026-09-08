import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LUCIDE } from "../workers/visual/icon-set.mjs";
import { ICON_COUNT, ICON_NAMES, findIcons, iconForQuery, iconSvg, iconSprite, hasIcon } from "../workers/visual/icons.mjs";
import { iconSvgForInstruction, sanitizeIconSvg, applyIconRevision } from "../workers/visual/icon-patch.mjs";
import { LocalSandbox } from "../workers/agent/sandbox/local.mjs";
import { createToolExecutor, TOOLS } from "../workers/agent/tools.mjs";

test("both workers embed the same generated icon set and lookup module", () => {
  for (const f of ["icon-set.mjs", "icons.mjs"]) {
    assert.equal(readFileSync(`workers/visual/${f}`, "utf8"), readFileSync(`workers/agent/${f}`, "utf8"), `${f} diverge tra i worker`);
  }
  assert.ok(ICON_COUNT > 1500, `set troppo piccolo: ${ICON_COUNT}`);
  assert.match(readFileSync("workers/visual/icon-set.mjs", "utf8").slice(0, 2000), /ISC License/);
});

test("every icon renders as a sanitizable stroke SVG under the patch bound", () => {
  for (const name of ICON_NAMES) {
    const svg = iconSvg(name);
    assert.ok(sanitizeIconSvg(svg), `svg non valido per ${name}`);
    assert.ok(!/<script|on\w+=|href=|xlink|<image|<foreignObject/i.test(LUCIDE[name][0]), `contenuto sospetto in ${name}`);
  }
  assert.match(iconSvg("calendar", { size: 20 }), /width="20" height="20"[^>]*aria-hidden="true"[^>]*data-icon="calendar"/);
  assert.match(iconSvg("calendar", { label: "Calendario" }), /role="img" aria-label="Calendario"/);
  assert.equal(iconSvg("does-not-exist"), "");
});

test("Italian and English queries resolve to sensible Lucide icons; nonsense is refused", () => {
  const cases = {
    calendario: "calendar", "usa un calendario": "calendar", prenotazioni: "calendar-check", clienti: "user", utenti: "user",
    impostazioni: "settings", ingranaggio: "settings", cerca: "search", carrello: "shopping-cart", statistiche: "chart-bar",
    fattura: "receipt", pagamenti: "credit-card", "chiave inglese": "wrench", "map pin": "map-pin", posizione: "map-pin",
    forbici: "scissors", dashboard: "layout-dashboard", login: "log-in", ristorante: "utensils", palestra: "dumbbell",
    settings: "settings", rocket: "rocket", apple: "apple", "tre puntini": "ellipsis", "codice qr": "qr-code", home: "house",
  };
  for (const [q, expected] of Object.entries(cases)) assert.equal(iconForQuery(q), expected, `query "${q}"`);
  for (const q of ["drago", "xyzzy", "", "un", "cambia l'icona"]) assert.equal(iconForQuery(q), null, `query "${q}" doveva fallire`);
  assert.deepEqual(findIcons("mail", { limit: 2 }).map((r) => r.name)[0], "mail");
  assert.ok(hasIcon("shopping-cart") && !hasIcon("shopping_cart"));
});

test("visual worker icon patch falls back to Lucide for named icons it does not draw itself", () => {
  const svg = iconSvgForInstruction("cambia l'icona della tab Impostazioni: usa un razzo");
  assert.ok(svg, "razzo → rocket");
  assert.match(svg, /data-icon="rocket"/);
  assert.match(svg, /stroke-width="1.8"/);
  assert.equal(iconSvgForInstruction("cambia l'icona della tab Fantasma: usa un drago"), null);
  // house pictograms still win for their own words
  assert.doesNotMatch(iconSvgForInstruction("icona tab Oggi: usa un calendario"), /data-icon=/);
  // tab name alone can pick a Lucide icon when the house set has nothing
  assert.match(iconSvgForInstruction("cambia l'icona della tab Prenotazioni") || "", /data-icon="calendar-check"/);
  const html = '<!doctype html><html><body><main><p>Saved data stays here in this view.</p></main><nav><button data-view="tools" data-fenix-id="icon:tools"><svg viewBox="0 0 24 24"><path d="M2 2h20"/></svg>Strumenti</button></nav><script>window.saved="unchanged";</script></body></html>';
  const ok = applyIconRevision({ html, instruction: "cambia icona della tab Strumenti: usa una chiave inglese" });
  assert.equal(ok.status, "ok");
  assert.match(ok.html, /data-icon="wrench"/);
});

test("sprite contains one symbol per unique name", () => {
  const sprite = iconSprite(["calendar", "calendar", "nope", "user"]);
  assert.equal((sprite.match(/<symbol /g) || []).length, 2);
  assert.match(sprite, /id="i-calendar"/);
});

test("agent `icons` tool returns inline markup and can write public/icons.svg", { timeout: 60_000 }, async () => {
  assert.ok(TOOLS.some((t) => t.name === "icons"));
  const sandbox = await LocalSandbox.create({ jobId: `icons-${process.pid}` });
  const ex = createToolExecutor(sandbox, { browserChecks: false });
  try {
    const r = await ex.execute("icons", { queries: ["prenotazioni", "clienti", "drago", "rocket"], size: 20 });
    assert.equal(r.ok, true);
    assert.match(r.output, /"prenotazioni" → calendar-check/);
    assert.match(r.output, /"clienti" → user \(alternative: users/);
    assert.match(r.output, /"drago": nessuna icona trovata/);
    assert.match(r.output, /"rocket" → rocket/);
    assert.match(r.output, /width="20" height="20"/);
    const s1 = await ex.execute("icons", { queries: ["calendar"], write_sprite: true });
    assert.equal(s1.ok, true);
    const s2 = await ex.execute("icons", { queries: ["user"], write_sprite: true });
    assert.equal(s2.ok, true);
    const sprite = await sandbox.readFile("public/icons.svg");
    assert.match(sprite, /id="i-calendar"/);
    assert.match(sprite, /id="i-user"/);
    assert.doesNotMatch(sprite, /display:none/);
    const bad = await ex.execute("icons", { queries: [] });
    assert.equal(bad.ok, false);
  } finally {
    await sandbox.destroy();
  }
});
