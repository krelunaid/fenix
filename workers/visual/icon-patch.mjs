// @ts-nocheck
/**
 * Atomic icon/tab patch. Pointed icon edits never regenerate the app.
 * Identity lives on data-fenix-id. Target absent/ambiguous is a hard fail
 * with no grok call. Worker full-rewrite / oversize / structural drift
 * is rejected; caller restores lastStable and refunds once.
 */

export const ICON_ID_ATTR = "data-fenix-id";
export const ICON_DELTA_BUDGET = 8192;
export const ICON_HTML_BOUND = 120000;
export const ICON_SVG_BOUND = 2048;

export const AGENDA_ICON_INSTRUCTION =
  "Cambia solo l'icona della tab Oggi: usa un calendario.";

export const AGENDA_CALENDAR_SVG =
  "<svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" overflow=\"hidden\" aria-hidden=\"true\"><rect x=\"4\" y=\"6\" width=\"16\" height=\"14\" rx=\"2\"/><path d=\"M8 4v4M16 4v4M4 10h16\"/><path d=\"M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01\"/></svg>";

const TAB_HINTS = [
  { id: "home", re: /\b(oggi|home|inizio|prime|mattina)\b/i },
  { id: "new", re: /\b(prenot|nuovo|new|inser|aggiungi)\b/i },
  { id: "list", re: /\b(appunt[ie]|elenco|list|appunti)\b/i },
  { id: "stats", re: /\b(settimana|stats|numer|week|kpi)\b/i },
  { id: "more", re: /\b(studio|altro|more|impost)\b/i },
  { id: "app", re: /\b(icona app|app icon|logo|intestaz|header)\b/i },
];

function fingerprint(text) {
  const s = String(text || "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
}

export function looksLikeIconInstruction(instruction) {
  const p = String(instruction || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!p) return false;
  if (/rifai|rigener|riscrivi|layout|palette|html intero|tutte le scherm|crud|formulario/.test(p)) {
    return false;
  }
  if (/\ble icone\b|\btutte le icon|\bicon[ae] delle tab\b/.test(p)) return false;
  return /icona|pittogramm|simbolo della tab/.test(p);
}

export function sanitizeIconSvg(raw) {
  const svg = String(raw || "").trim();
  if (!svg || svg.length > ICON_SVG_BOUND) return "";
  if (!/^<svg[\s\S]*<\/svg>$/i.test(svg)) return "";
  if (/<script|on\w+\s*=|javascript:/i.test(svg)) return "";
  return svg;
}

function listIdentities(html) {
  const ids = new Set();
  const re = /data-fenix-id=["']([^"']+)["']/gi;
  let match;
  while ((match = re.exec(String(html || "")))) ids.add(match[1]);
  return ids;
}

function listViews(html) {
  return [...String(html || "").matchAll(/data-view=["']([^"']+)["']/gi)].map((m) => m[1]);
}

export function snapshotStructure(html, files = []) {
  const text = String(html || "");
  return {
    views: listViews(text).sort().join(","),
    templates: [...text.matchAll(/<template[^>]*\bid=["']([^"']+)["']/gi)]
      .map((m) => m[1])
      .sort()
      .join(","),
    fenixData: /Fenix\.data/i.test(text),
    fenixLoad: /Fenix\.load/i.test(text),
    fenixSave: /Fenix\.save/i.test(text),
    forms: (text.match(/<form\b/gi) || []).length,
    size: text.length,
    files: Object.fromEntries(
      (files || []).map((f) => [String(f.path || ""), fingerprint(f.content || "")]),
    ),
  };
}

export function structuralDrift(before, after) {
  if (!before || !after) return "struttura assente";
  if (before.views !== after.views) return "viste alterate";
  if (before.templates !== after.templates) return "template alterati";
  if (before.fenixData !== after.fenixData) return "Fenix.data alterato";
  if (before.fenixLoad !== after.fenixLoad) return "Fenix.load alterato";
  if (before.fenixSave !== after.fenixSave) return "Fenix.save alterato";
  if (before.forms !== after.forms) return "form alterati";
  for (const [path, hash] of Object.entries(after.files || {})) {
    if (path === "index.html") continue;
    if ((before.files || {})[path] !== hash) return `file non target ${path}`;
  }
  for (const path of Object.keys(before.files || {})) {
    if (path === "index.html") continue;
    if (!(path in (after.files || {}))) return `file rimosso ${path}`;
  }
  return "";
}

function hintIds(instruction) {
  const p = String(instruction || "");
  return TAB_HINTS.filter((row) => row.re.test(p)).map((row) => row.id);
}

function identityFor(id) {
  return `icon:${id}`;
}

export function resolveIconTarget(html, instruction) {
  const text = String(html || "");
  const hinted = hintIds(instruction);
  const identities = listIdentities(text);
  const views = new Set(listViews(text));
  const hits = [];

  const consider = (id, why) => {
    const fenixId = identityFor(id);
    const present =
      identities.has(fenixId) ||
      identities.has(id) ||
      views.has(id) ||
      (id === "app" && /fk-appicon|rel=["']icon["']/i.test(text));
    if (present) hits.push({ id: identities.has(fenixId) ? fenixId : fenixId, why });
  };

  if (hinted.length === 1) consider(hinted[0], "instruction");
  else if (hinted.length > 1) {
    return {
      status: "ambiguous",
      id: "",
      reason: `Icona ambigua: ${hinted.join(", ")}. Nessun credito speso.`,
    };
  } else if (/solo l['']icona|cambia l['']icona|modifica l['']icona/i.test(String(instruction || ""))) {
    return {
      status: "ambiguous",
      id: "",
      reason: "Icona ambigua: manca il target (tab o icona app). Nessun credito speso.",
    };
  } else {
    return {
      status: "absent",
      id: "",
      reason: "Icona assente: nessun target nella richiesta. Nessun credito speso.",
    };
  }

  if (!hits.length) {
    return {
      status: "absent",
      id: "",
      reason: "Icona assente: nodo non trovato nel DOM. Nessun credito speso.",
    };
  }
  const unique = [...new Set(hits.map((h) => h.id))];
  if (unique.length !== 1) {
    return {
      status: "ambiguous",
      id: "",
      reason: `Icona ambigua: ${unique.join(", ")}. Nessun credito speso.`,
    };
  }
  return { status: "ok", id: unique[0], reason: "" };
}

function replaceSvgInChunk(chunk, svg) {
  if (/<svg[\s\S]*?<\/svg>/i.test(chunk)) {
    return chunk.replace(/<svg[\s\S]*?<\/svg>/i, svg);
  }
  return chunk.replace(/(<button\b[^>]*>|<span\b[^>]*fk-appicon[^>]*>)/i, `$1${svg}`);
}

export function applyIconPatch(html, fenixId, svg) {
  const safe = sanitizeIconSvg(svg);
  const id = String(fenixId || "");
  if (!html || !id || !safe) {
    return { html: html || "", applied: false, reason: "empty", id };
  }
  const attr = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const buttonRe = new RegExp(
    `(<(?:button|span|a|div)[^>]*${ICON_ID_ATTR}=["']${attr}["'][^>]*>)([\\s\\S]*?)(</(?:button|span|a|div)>)`,
    "i",
  );
  if (buttonRe.test(html)) {
    const next = String(html).replace(buttonRe, (_, open, inner, close) => {
      return `${open}${replaceSvgInChunk(inner, safe)}${close}`;
    });
    if (next === html) return { html, applied: false, reason: "unchanged", id };
    return { html: next, applied: true, reason: "ok", id };
  }
  const viewId = id.replace(/^icon:/, "");
  const viewRe = new RegExp(
    `(<(?:button|a)[^>]*data-view=["']${viewId}["'][^>]*>)([\\s\\S]*?)(</(?:button|a)>)`,
    "i",
  );
  if (viewRe.test(html)) {
    const next = String(html).replace(viewRe, (_, open, inner, close) => {
      const stamped = /\bdata-fenix-id=/i.test(open)
        ? open
        : open.replace(/<button\b/i, `<button ${ICON_ID_ATTR}="${id}"`);
      return `${stamped}${replaceSvgInChunk(inner, safe)}${close}`;
    });
    if (next === html) return { html, applied: false, reason: "unchanged", id };
    return { html: next, applied: true, reason: "ok", id };
  }
  return { html, applied: false, reason: "absent", id };
}

export function iconSvgForInstruction(instruction) {
  const p = String(instruction || "").toLowerCase();
  if (/calend|oggi|agenda|data/.test(p)) return AGENDA_CALENDAR_SVG;
  return AGENDA_CALENDAR_SVG;
}

function filesUnchanged(before = [], after = []) {
  const left = new Map((before || []).map((f) => [f.path, f.content]));
  const right = new Map((after || []).map((f) => [f.path, f.content]));
  if (left.size !== right.size) return false;
  for (const [path, content] of left) {
    if (path === "index.html") continue;
    if (right.get(path) !== content) return false;
  }
  for (const path of right.keys()) {
    if (path === "index.html") continue;
    if (!left.has(path)) return false;
  }
  return true;
}

function looksLikeFullRewrite(before, after) {
  const a = String(before || "");
  const b = String(after || "");
  if (!a || !b) return true;
  if (Math.abs(b.length - a.length) > ICON_DELTA_BUDGET) return true;
  const stripped = (s) =>
    s
      .replace(/<svg[\s\S]*?<\/svg>/gi, "<svg/>")
      .replace(/\s+/g, " ");
  const da = stripped(a);
  const db = stripped(b);
  if (da === db) return false;
  const shared = Math.min(da.length, db.length);
  let same = 0;
  for (let i = 0; i < shared; i += 1) if (da[i] === db[i]) same += 1;
  return same / Math.max(da.length, 1) < 0.92;
}

/**
 * @param {{ html: string, files?: {path:string,content:string}[], instruction: string, worker?: { html?: string, files?: {path:string,content:string}[] } }} input
 */
export function applyIconRevision(input) {
  const html = String(input?.html || "");
  const files = Array.isArray(input?.files) ? input.files : [];
  const instruction = String(input?.instruction || "");
  const log = [];
  if (!looksLikeIconInstruction(instruction)) {
    return {
      status: "rejected",
      spent: false,
      refund: false,
      html,
      files,
      reason: "Richiesta non è una patch di icona.",
      log,
    };
  }
  const target = resolveIconTarget(html, instruction);
  if (target.status !== "ok") {
    log.push(target.reason);
    return {
      status: target.status,
      spent: false,
      refund: false,
      html,
      files,
      reason: target.reason,
      log,
    };
  }

  if (input?.worker && (input.worker.html || (input.worker.files && input.worker.files.length))) {
    const nextHtml = String(input.worker.html || html);
    const nextFiles = Array.isArray(input.worker.files) ? input.worker.files : files;
    const before = snapshotStructure(html, files);
    const after = snapshotStructure(nextHtml, nextFiles);
    const drift = structuralDrift(before, after);
    if (nextHtml.length > ICON_HTML_BOUND) {
      return {
        status: "rejected",
        spent: true,
        refund: true,
        html,
        files,
        reason: "Output worker oversize: ripristino lastStable, credito rimborsato una volta.",
        log: ["rifiuto oversize"],
      };
    }
    if (drift) {
      return {
        status: "rejected",
        spent: true,
        refund: true,
        html,
        files,
        reason: `Output worker deriva: ${drift}. Ripristino lastStable, credito rimborsato una volta.`,
        log: [drift],
      };
    }
    if (!filesUnchanged(files, nextFiles)) {
      return {
        status: "rejected",
        spent: true,
        refund: true,
        html,
        files,
        reason: "Output worker altera file non target. Ripristino lastStable, credito rimborsato una volta.",
        log: ["file non target"],
      };
    }
    if (looksLikeFullRewrite(html, nextHtml)) {
      return {
        status: "rejected",
        spent: true,
        refund: true,
        html,
        files,
        reason: "Output worker full-rewrite: ripristino lastStable, credito rimborsato una volta.",
        log: ["rifiuto full-rewrite"],
      };
    }
    const delta = Math.abs(nextHtml.length - html.length);
    if (delta > ICON_DELTA_BUDGET) {
      return {
        status: "rejected",
        spent: true,
        refund: true,
        html,
        files,
        reason: "Output worker oltre budget di patch. Ripristino lastStable, credito rimborsato una volta.",
        log: ["budget"],
      };
    }
    log.push(`Patch atomica ${target.id}`);
    return {
      status: "ok",
      spent: true,
      refund: false,
      html: nextHtml,
      files,
      reason: "",
      log,
    };
  }

  const svg = iconSvgForInstruction(instruction);
  const patched = applyIconPatch(html, target.id, svg);
  if (!patched.applied) {
    const reason =
      patched.reason === "absent"
        ? "Icona assente: nodo non trovato nel DOM. Nessun credito speso."
        : "Icona invariata. Nessun credito speso.";
    return {
      status: patched.reason === "absent" ? "absent" : "rejected",
      spent: false,
      refund: false,
      html,
      files,
      reason,
      log: [reason],
    };
  }
  const before = snapshotStructure(html, files);
  const after = snapshotStructure(patched.html, files);
  const drift = structuralDrift(before, after);
  if (drift) {
    return {
      status: "rejected",
      spent: false,
      refund: false,
      html,
      files,
      reason: `Patch scartata: ${drift}. Nessun credito speso.`,
      log: [drift],
    };
  }
  log.push(`Patch atomica ${target.id}`);
  return {
    status: "ok",
    spent: true,
    refund: false,
    html: patched.html,
    files,
    reason: "",
    log,
  };
}

/**
 * Honor a single refund for a rejected worker icon patch.
 * @param {{ creditRefunded?: boolean, lastStableHtml?: string, lastStableFiles?: {path:string,content:string}[], html?: string, files?: {path:string,content:string}[] }} project
 */
export function refundIconFailure(project, verdict) {
  const html = verdict?.html ?? project?.html ?? "";
  const files = verdict?.files ?? project?.files;
  const restored = {
    html: project?.lastStableHtml || html,
    files: project?.lastStableFiles || files,
  };
  if (!verdict?.refund) {
    return { ...restored, creditRefunded: Boolean(project?.creditRefunded), refundedNow: false };
  }
  if (project?.creditRefunded) {
    return { ...restored, creditRefunded: true, refundedNow: false };
  }
  return { ...restored, creditRefunded: true, refundedNow: true };
}
