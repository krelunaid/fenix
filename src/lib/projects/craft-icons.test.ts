import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APP_SHELL_HTML } from "../ai/app-shell.ts";
import {
  countAppleTabIcons,
  looksLikeAppleTabIcons,
  replaceAppleTabIcons,
} from "./craft-icons.ts";
import { recoverPersistedProject } from "./recover.ts";
import { validateProductHtml } from "./validate-html.ts";

const APPLE_NAV = `<nav class="fk-tab" aria-label="Navigazione">
<button data-view="home"><svg viewBox="0 0 24 24"><path d="M4 10.5 12 4l8 6.5V20H4z"/></svg><span>Oggi</span></button>
<button data-view="new"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg><span>Nuovo</span></button>
<button data-view="list"><svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h10"/></svg><span>Elenco</span></button>
<button data-view="stats"><svg viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-7"/></svg><span>Stat</span></button>
<button data-view="more"><svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="3"/><path d="M5 20c1.5-4 12.5-4 14 0"/></svg><span>Squadra</span></button>
</nav>`;

const APPLE_APP = `<!DOCTYPE html><html><body>
<main>x</main>${APPLE_NAV}
<script>window.Fenix={load:function(){return Promise.resolve({})},save:function(){}}</script>
</body></html>`;

describe("craft icons vs Apple chrome", () => {
  it("detects the iPhone house/plus/person set and rewrites it", () => {
    assert.equal(looksLikeAppleTabIcons(APPLE_APP), true);
    assert.ok(countAppleTabIcons(APPLE_APP) >= 4);
    const next = replaceAppleTabIcons(APPLE_APP);
    assert.equal(looksLikeAppleTabIcons(next), false);
    assert.match(next, /M6 3\.5h11\.5v17H6z/);
    assert.match(next, /Oggi/);
    assert.doesNotMatch(next, /M4 10\.5 12 4l8 6\.5V20H4z/);
  });

  it("keeps APP_SHELL publishable as an app because it no longer ships Apple tabs", () => {
    assert.equal(looksLikeAppleTabIcons(APP_SHELL_HTML), false);
    const report = validateProductHtml(APP_SHELL_HTML, { kind: "app" });
    assert.equal(report.ok, true, report.errors.join(" · "));
  });

  it("rejects leftover Apple tabs on a phone app and recover rewrites them", () => {
    const report = validateProductHtml(APPLE_APP, { kind: "app" });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /pittogrammi del mestiere/i.test(e)));
    const recovered = recoverPersistedProject({
      id: "taccuino",
      status: "ready",
      html: APPLE_APP,
      kind: "app",
      updatedAt: Date.now(),
    });
    assert.equal(looksLikeAppleTabIcons(recovered.html), false);
    assert.match(recovered.html, /M6 3\.5h11\.5v17H6z/);
  });
});
