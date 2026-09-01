/**
 * Phone-tab splice used by the visual worker.
 * Never invents missing <template id="t-*"> nodes. A no-op on an absent
 * target must not consume another grok-build-0.1 round.
 */
export const TAB_IDS = ["home", "new", "list", "stats", "more"];

/** @param {string} inner */
export function looksLikeCssDump(inner) {
  const s = String(inner || "");
  return /\.fk-(hello|tab|sheet|main|top)\s*\{/.test(s) && !/^\s*</.test(s);
}

/** @param {string} id */
export function screenTargetId(id) {
  const token = String(id || "").toLowerCase();
  return TAB_IDS.includes(token) ? token : "home";
}

/**
 * @param {string} html
 * @param {string} id
 */
export function hasScreenTarget(html, id) {
  const tid = screenTargetId(id);
  const tRe = new RegExp(`<template[^>]*\\bid=["']t-${tid}["'][^>]*>`, "i");
  return tRe.test(String(html || ""));
}

/**
 * @param {string} html
 * @param {string} id
 * @param {string} inner
 * @returns {{ html: string, applied: boolean, reason: "ok" | "absent" | "css-dump" | "empty", id: string }}
 */
export function applyScreenPatch(html, id, inner) {
  if (!html || !inner) return { html, applied: false, reason: "empty", id: screenTargetId(id) };
  if (looksLikeCssDump(inner)) {
    return { html, applied: false, reason: "css-dump", id: screenTargetId(id) };
  }
  const tid = screenTargetId(id);
  if (!hasScreenTarget(html, tid)) {
    return { html, applied: false, reason: "absent", id: tid };
  }
  const tRe = new RegExp(
    `(<template[^>]*\\bid=["']t-${tid}["'][^>]*>)([\\s\\S]*?)(<\\/template>)`,
    "i",
  );
  const next = String(html).replace(tRe, `$1${inner}$3`);
  if (next === html) return { html, applied: false, reason: "absent", id: tid };
  return { html: next, applied: true, reason: "ok", id: tid };
}

/**
 * Log each absent tab once. Returns false when the skip is a duplicate.
 * @param {Set<string>} absent
 * @param {string[]} log
 * @param {string} id
 * @param {boolean} [extra]
 */
export function noteAbsent(absent, log, id, extra = false) {
  const tid = screenTargetId(id);
  if (absent.has(tid)) return false;
  absent.add(tid);
  log.push(extra ? `Patch extra ${tid} ignorata: nodo assente` : `Patch ${tid} ignorata: nodo assente`);
  return true;
}
