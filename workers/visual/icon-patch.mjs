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
  { id: "home", re: /\b(oggi|home|inizio|prime|mattina|tavolo)\b/i },
  { id: "new", re: /\b(prenot|nuovo|new|inser|aggiungi|registr)\b/i },
  { id: "list", re: /\b(appunt[ie]|elenco|list|appunti|archivio)\b/i },
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
  if (/\btutte le icon|\ble icone\b|\bicone delle tab\b/.test(p)) return false;
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

function stripMarkup(inner) {
  return String(inner || "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<img\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namedTabToken(instruction) {
  const p = String(instruction || "");
  const tab = p.match(/\btab\s+["']?([A-Za-zÀ-ÿ0-9]+)["']?/i);
  if (tab && tab[1] && !/^tab$/i.test(tab[1])) return tab[1];
  const icona = p.match(/\bicona\s+(?:della\s+|delle\s+|di\s+)?(?:tab\s+)?["']?([A-Za-zÀ-ÿ0-9]+)["']?/i);
  if (icona && icona[1] && !/^(della|delle|di|tab|app|solo)$/i.test(icona[1])) return icona[1];
  return "";
}

export function listTabNodes(html) {
  const nodes = [];
  const re =
    /<(button|a|span|div)([^>]*\b(?:data-view|data-fenix-id)=[^>]*)>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = re.exec(String(html || "")))) {
    const attrs = match[2] || "";
    const inner = match[3] || "";
    const view = (attrs.match(/\bdata-view=["']([^"']+)["']/i) || [])[1] || "";
    const fenixId = (attrs.match(/\bdata-fenix-id=["']([^"']+)["']/i) || [])[1] || "";
    const isApp =
      /fk-appicon/i.test(attrs) || fenixId === "icon:app" || fenixId === "app";
    if (!view && !fenixId && !isApp) continue;
    const id = fenixId || (isApp ? "icon:app" : identityFor(view));
    nodes.push({
      id,
      view: view || (isApp ? "app" : id.replace(/^icon:/, "")),
      label: stripMarkup(inner),
      app: Boolean(isApp && !view),
      index: nodes.length,
    });
  }
  return nodes;
}

function nodeMatchesToken(node, token) {
  const needle = String(token || "").toLowerCase();
  if (!needle) return false;
  const view = String(node.view || "").toLowerCase();
  const id = String(node.id || "").toLowerCase();
  const label = String(node.label || "").toLowerCase();
  return (
    label === needle ||
    label.includes(needle) ||
    view === needle ||
    id === needle ||
    id === `icon:${needle}`
  );
}

export function resolveIconTarget(html, instruction) {
  const nodes = listTabNodes(html);
  const hinted = hintIds(instruction);
  const named = namedTabToken(instruction);
  const hits = [];
  const canonical = new Set(["home", "new", "list", "stats", "more", "app"]);

  if (named) {
    for (const node of nodes) {
      if (nodeMatchesToken(node, named)) hits.push(node);
    }
  }

  if (!hits.length && hinted.length === 1) {
    const role = hinted[0];
    if (role === "app") {
      const app = nodes.find((n) => n.app || n.id === "icon:app" || n.view === "app");
      if (app) hits.push(app);
    } else {
      for (const node of nodes) {
        if (node.app) continue;
        if (node.view === role || node.id === identityFor(role) || node.id === role) {
          hits.push(node);
        } else if (TAB_HINTS.find((row) => row.id === role)?.re.test(`${node.label} ${node.view}`)) {
          hits.push(node);
        }
      }
      const allowOrdinal = !named || canonical.has(named.toLowerCase());
      if (!hits.length && allowOrdinal) {
        const ordinal = ["home", "new", "list", "stats", "more"].indexOf(role);
        const tabs = nodes.filter((n) => !n.app);
        if (ordinal >= 0 && tabs[ordinal]) hits.push(tabs[ordinal]);
      }
    }
  } else if (!hits.length && hinted.length > 1) {
    return {
      status: "ambiguous",
      id: "",
      reason: `Icona ambigua: ${hinted.join(", ")}. Nessun credito speso.`,
    };
  }

  const unique = [...new Map(hits.map((h) => [h.id, h])).values()];
  if (unique.length === 1) {
    return { status: "ok", id: unique[0].id, reason: "" };
  }
  if (unique.length > 1) {
    return {
      status: "ambiguous",
      id: "",
      reason: `Icona ambigua: ${unique.map((h) => h.id).join(", ")}. Nessun credito speso.`,
    };
  }

  if (named) {
    return {
      status: "absent",
      id: "",
      reason: "Icona assente: nodo non trovato nel DOM. Nessun credito speso.",
    };
  }
  if (/solo l['']icona|cambia l['']icona|modifica(?:re)?\s+(?:un['']?|l['']|la\s+)?icona/i.test(String(instruction || ""))) {
    return {
      status: "ambiguous",
      id: "",
      reason: "Icona ambigua: manca il target (tab o icona app). Nessun credito speso.",
    };
  }
  return {
    status: "absent",
    id: "",
    reason: "Icona assente: nodo non trovato nel DOM. Nessun credito speso.",
  };
}

function replaceSvgInChunk(chunk, svg) {
  const inner = String(chunk || "");
  if (/<svg[\s\S]*?<\/svg>/i.test(inner)) {
    return inner.replace(/<svg[\s\S]*?<\/svg>/i, svg);
  }
  if (/<img\b[^>]*\/?>/i.test(inner)) {
    return inner.replace(/<img\b[^>]*\/?>/i, svg);
  }
  if (/<span\b[^>]*aria-hidden=["']true["'][^>]*>[\s\S]*?<\/span>/i.test(inner)) {
    return inner.replace(/<span\b[^>]*aria-hidden=["']true["'][^>]*>[\s\S]*?<\/span>/i, svg);
  }
  const emoji = inner.match(
    /^(\s*)(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u,
  );
  if (emoji) return inner.replace(emoji[0], `${emoji[1]}${svg}`);
  return `${svg}${inner}`;
}

export function applyIconPatch(html, fenixId, svg) {
  const safe = sanitizeIconSvg(svg);
  const id = String(fenixId || "");
  if (!html || !id || !safe) {
    return { html: html || "", applied: false, reason: "empty", id };
  }
  const attr = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const buttonRe = new RegExp(
    `(<(button|span|a|div)[^>]*${ICON_ID_ATTR}=["']${attr}["'][^>]*>)([\\s\\S]*?)(<\\/\\2>)`,
    "i",
  );
  if (buttonRe.test(html)) {
    const next = String(html).replace(buttonRe, (_, open, _tag, inner, close) => {
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

const SVG_OPEN =
  "<svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" overflow=\"hidden\" aria-hidden=\"true\">";
const icon = (body) => `${SVG_OPEN}${body}</svg>`;

/**
 * Pictograms the atomic icon patch can draw, same stroke grammar as the calendar.
 * Order matters: the first matching entry wins, so specific words come before generic ones.
 */
export const ICON_LIBRARY = [
  { id: "calendar", re: /calend|agenda|\bdata\b|\boggi\b/, svg: AGENDA_CALENDAR_SVG },
  { id: "list", re: /\blista\b|elenco|righe|\blist\b/, svg: icon('<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>') },
  { id: "plus", re: /\bpi[uù]\b|aggiungi|nuovo|\bplus\b|croce/, svg: icon('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>') },
  { id: "user", re: /client[ei]|utent[ei]|persona|profilo|\buser\b|omino/, svg: icon('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>') },
  { id: "users", re: /\bteam\b|staff|gruppo|persone|\busers\b/, svg: icon('<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="3"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><path d="M15 14.5c3 .3 5.5 2.5 5.5 5.5"/>') },
  { id: "settings", re: /impostazion|ingranaggio|settings|\bgear\b|configur/, svg: icon('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>') },
  { id: "search", re: /cerca|ricerca|lente|search/, svg: icon('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>') },
  { id: "heart", re: /cuore|preferit|heart|amat/, svg: icon('<path d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10z"/>') },
  { id: "cart", re: /carrello|\bcart\b|acquist|ordin[ei]/, svg: icon('<circle cx="9" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/><path d="M3 4h2l2.4 11h10.8L20 8H6.2"/>') },
  { id: "stats", re: /statistic|grafic|numer|\bkpi\b|andament|\bstats\b|barre/, svg: icon('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>') },
  { id: "home", re: /\bhome\b|\bcasa\b|inizio/, svg: icon('<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>') },
  { id: "scissors", re: /forbic|taglio|barbier|scissor/, svg: icon('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 8l11.5 11M8.5 16L20 5"/>') },
  { id: "clock", re: /orolog|\bora\b|orario|clock|\btempo\b/, svg: icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') },
  { id: "bell", re: /campan|notific|avvis|\bbell\b/, svg: icon('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>') },
  { id: "pin", re: /\bmappa\b|posizion|\bluogo\b|indirizz|\bpin\b|segnapost/, svg: icon('<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.5"/>') },
  { id: "camera", re: /fotocamera|\bfoto\b|camera|scatt/, svg: icon('<path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>') },
  { id: "mail", re: /\bmail\b|email|busta|posta|messagg/, svg: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>') },
  { id: "phone", re: /telefon|chiam|\bphone\b|cornetta/, svg: icon('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>') },
  { id: "star", re: /stell|\bstar\b|valutaz|rating/, svg: icon('<path d="M12 3l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.4l-5.7 3.1 1.2-6.4L2.8 9.7l6.4-.8z"/>') },
  { id: "tag", re: /etichett|prezz|\btag\b|sconto|offert/, svg: icon('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>') },
  { id: "doc", re: /document|fattur|\bfile\b|foglio|ricevut|report/, svg: icon('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>') },
  { id: "menu", re: /\bmen[uù]\b|hamburger|tre linee|altro/, svg: icon('<path d="M4 7h16M4 12h16M4 17h16"/>') },
];

/** Returns the SVG matching the instruction, or null when no known icon is named. */
export function iconSvgForInstruction(instruction) {
  const p = String(instruction || "").toLowerCase();
  // Look only at the part after the "use/with/become" verb, if present, so the tab
  // name ("tab Oggi") does not pick the icon ("usa una lista").
  const parts = p.split(/\b(?:usa|con|metti|diventa|sostituisci con|scegli|imposta)\b/);
  const named = parts.length > 1 ? parts.slice(1).join(" ") : "";
  if (named.trim()) {
    // An icon was named explicitly: it must be one we know, otherwise refuse.
    for (const entry of ICON_LIBRARY) if (entry.re.test(named)) return entry.svg;
    return null;
  }
  // No icon named: let the tab name suggest one (Oggi → calendar, Clienti → user, …).
  for (const entry of ICON_LIBRARY) if (entry.re.test(p)) return entry.svg;
  return null;
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
  if (!svg) {
    const reason = "Icona non riconosciuta: dimmi quale (calendario, lista, cliente, ingranaggio, cerca, cuore, carrello, grafico, casa, forbici, orologio, campanella, mappa, foto, mail, telefono, stella, etichetta, documento, menu). Nessun credito speso.";
    return { status: "rejected", spent: false, refund: false, html, files, reason, log: [reason] };
  }
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
