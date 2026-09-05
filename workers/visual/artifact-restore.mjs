import { looksLikeCssDump } from "./screen-patch.mjs";

/** @param {string} html */
export function restoreHome(html) {
  const m = html.match(/<template[^>]*id=["']t-home["'][^>]*>([\s\S]*?)<\/template>/i);
  if (!m || !/<main\b/i.test(html) || looksLikeCssDump(m[1])) return html;
  // Generated content is literal data, never a replacement-string program.
  return html.replace(/<main\b[^>]*>[\s\S]*?<\/main>/i, () => `<main class="fk-main">${m[1]}</main>`);
}

/** @param {string} from @param {string} to */
export function keepScripts(from, to) {
  if (!from || !to) return to;
  /** @param {string} html */
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
    ? stripped.replace(/<\/body>/i, () => `${block}</body>`)
    : `${stripped}${block}`;
}
