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
 * Prefer the returned SCREEN id when that node exists; otherwise the
 * requested tab. Never invent a missing template.
 * @param {string} html
 * @param {string} requested
 * @param {string} [returned]
 */
export function resolvePatchTarget(html, requested, returned) {
  const want = screenTargetId(requested);
  const got = String(returned || "").toLowerCase();
  if (TAB_IDS.includes(got) && hasScreenTarget(html, got)) return got;
  if (hasScreenTarget(html, want)) return want;
  return TAB_IDS.includes(got) ? got : want;
}

/**
 * @param {string} html
 * @param {string} id
 * @param {Set<string>} [absent]
 * @param {Set<string>} [extraTried]
 */
export function shouldPolishTab(html, id, absent, extraTried) {
  const tid = screenTargetId(id);
  if (absent && absent.has(tid)) return false;
  if (!hasScreenTarget(html, tid)) return false;
  if (extraTried && extraTried.has(tid)) return false;
  return true;
}

/**
 * @param {string} html
 * @param {string} id
 * @param {string} inner
 * @returns {{ html: string, applied: boolean, reason: "ok" | "absent" | "unchanged" | "css-dump" | "empty", id: string }}
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
  if (next === html) return { html, applied: false, reason: "unchanged", id: tid };
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

/**
 * Dedup skip logs (absent / unchanged / css-dump) across extra vs main.
 * @param {Set<string>} seen
 * @param {string[]} log
 * @param {string} id
 * @param {string} reason
 * @param {boolean} [extra]
 */
export function noteSkip(seen, log, id, reason, extra = false) {
  const tid = screenTargetId(id);
  const key = `${tid}:${reason}`;
  if (seen.has(key)) return false;
  seen.add(key);
  const label = extra ? `Patch extra ${tid}` : `Patch ${tid}`;
  if (reason === "absent") {
    log.push(`${label} ignorata: nodo assente`);
    return true;
  }
  if (reason === "unchanged") {
    log.push(`${label} invariata`);
    return true;
  }
  if (reason === "css-dump") {
    log.push(`${label} ignorata: CSS leak`);
    return true;
  }
  log.push(`${label} ignorata`);
  return true;
}
