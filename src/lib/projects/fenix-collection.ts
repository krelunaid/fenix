/**
 * Shared Fenix collection token. Runtime, cloud store, planner and HTML gate
 * must agree: never widen this regex, never accept traversal or reserved keys.
 * Adapter/Fenix.data stay fail-closed — they do not slugify user input.
 * Known wardrobe aliases collapse to `capi` in the planner/adapter only.
 */
export const FENIX_COLLECTION_RE = /^[A-Za-z0-9._-]{1,80}$/;
export const FENIX_COLLECTION_FORBIDDEN = ["__proto__", "prototype", "constructor"] as const;

/** Restricted canonical names. Aliases map here; unknown spaced labels stay invalid. */
export const FENIX_CANONICAL_CAPI = "capi";

const WARDROBE_ALIASES = new Set([
  "capi",
  "capi vesti",
  "vesti",
  "guardaroba",
  "armadio",
  "abito",
  "abiti",
  "outfit",
  "lookbook",
  "wardrobe",
]);

export type FenixCollectionHit = {
  api: "data" | "load";
  raw: string;
  valid: boolean;
};

export function parseFenixCollection(value: unknown): string | null {
  const col = String(value ?? "");
  if (!FENIX_COLLECTION_RE.test(col)) return null;
  if ((FENIX_COLLECTION_FORBIDDEN as readonly string[]).includes(col)) return null;
  return col;
}

function foldCollectionLabel(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Restricted canonicalisation. Wardrobe aliases → capi. Already-legal tokens
 * stay as-is. Spaced/unknown labels and traversal return null — never invent
 * a new collection by slugifying arbitrary input.
 */
export function canonicalFenixCollection(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw || /[/\\]|\.\./.test(raw)) return null;
  if (WARDROBE_ALIASES.has(foldCollectionLabel(raw))) {
    return parseFenixCollection(FENIX_CANONICAL_CAPI);
  }
  return parseFenixCollection(raw);
}

/**
 * Planner/parser only. Maps a brief label onto a legal token.
 * Rejects traversal; never used at the Fenix.data runtime boundary.
 * Returns null when the value cannot become a legal token without widening.
 */
export function slugFenixCollection(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw || /[/\\]|\.\./.test(raw)) return null;
  const canon = canonicalFenixCollection(raw);
  if (canon) return canon;
  const slug = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 80);
  return parseFenixCollection(slug);
}

export function normalizeFenixCollection(value: unknown, fallback = "voci"): string {
  return (
    canonicalFenixCollection(value) ||
    slugFenixCollection(value) ||
    parseFenixCollection(fallback) ||
    "voci"
  );
}

const DATA_CALL =
  /\b(?:window\.)?Fenix\.data\.(?:query|list|get|insert|update|remove)\s*\(\s*(["'`])([^"'`]*)\1/g;
const LOAD_CALL = /\b(?:window\.)?Fenix\.(?:load|save)\s*\(\s*(["'`])([^"'`]*)\1/g;
const DATA_IDENT =
  /\b(?:window\.)?Fenix\.data\.(?:query|list|get|insert|update|remove)\s*\(\s*([A-Za-z_$][\w$]*)/g;
const LOAD_IDENT = /\b(?:window\.)?Fenix\.(?:load|save)\s*\(\s*([A-Za-z_$][\w$]*)/g;
const DECL_ASSIGN =
  /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(["'`])([^"'`]*)\2/g;
const BARE_ASSIGN = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*=\s*(["'`])([^"'`]*)\2/g;

function assignedCollections(code: string): Map<string, string> {
  const map = new Map<string, string>();
  const src = String(code || "");
  for (const re of [DECL_ASSIGN, BARE_ASSIGN]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(src))) {
      map.set(match[1], match[3] ?? "");
    }
  }
  return map;
}

export function extractFenixCollectionHits(code: string): FenixCollectionHit[] {
  const hits: FenixCollectionHit[] = [];
  const seen = new Set<string>();
  const push = (api: FenixCollectionHit["api"], raw: string) => {
    const key = `${api}:${raw}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ api, raw, valid: Boolean(parseFenixCollection(raw)) });
  };
  const src = String(code || "");
  const assigned = assignedCollections(src);
  for (const re of [DATA_CALL, LOAD_CALL]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    const api: FenixCollectionHit["api"] = re === DATA_CALL ? "data" : "load";
    while ((match = re.exec(src))) push(api, match[2] ?? "");
  }
  for (const re of [DATA_IDENT, LOAD_IDENT]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    const api: FenixCollectionHit["api"] = re === DATA_IDENT ? "data" : "load";
    while ((match = re.exec(src))) {
      const ident = match[1] || "";
      if (!ident || !assigned.has(ident)) continue;
      push(api, assigned.get(ident) || "");
    }
  }
  return hits;
}

export function invalidFenixCollectionError(code: string): string {
  const bad = extractFenixCollectionHits(code).find((hit) => !hit.valid);
  if (!bad) return "";
  return `Fenix.data: collezione non valido ("${bad.raw.slice(0, 80)}")`;
}

function rewriteQuotedAlias(raw: string): string {
  const canon = canonicalFenixCollection(raw);
  return canon && canon !== raw ? canon : raw;
}

/** Rewrite known aliases in JS. Unknown/invalid tokens stay so the gate can fail-closed. */
export function rewriteFenixCollectionCode(code: string): string {
  let next = String(code || "");
  const idents = new Set<string>();
  for (const re of [DATA_IDENT, LOAD_IDENT]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(next))) {
      const ident = match[1] || "";
      if (ident && !/^(?:true|false|null|undefined)$/.test(ident)) idents.add(ident);
    }
  }
  const rewriteCall = (all: string, quote: string, raw: string) => {
    const canon = rewriteQuotedAlias(raw);
    if (canon === raw) return all;
    return all.replace(`${quote}${raw}${quote}`, `${quote}${canon}${quote}`);
  };
  DATA_CALL.lastIndex = 0;
  next = next.replace(DATA_CALL, rewriteCall);
  LOAD_CALL.lastIndex = 0;
  next = next.replace(LOAD_CALL, rewriteCall);
  for (const id of idents) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `(\\b(?:var|let|const)\\s+${escaped}\\s*=\\s*|\\b${escaped}\\s*=\\s*)(["'\`])([^"'\`]*)\\2`,
      "g",
    );
    next = next.replace(re, (all, left: string, quote: string, raw: string) => {
      const canon = rewriteQuotedAlias(raw);
      if (canon === raw) return all;
      return `${left}${quote}${canon}${quote}`;
    });
  }
  return next;
}

/** Adapter/preview only. Rewrites known aliases inside product <script> bodies. */
export function rewriteFenixCollections(html: string): string {
  return String(html || "").replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (full, attrs: string, body: string) => {
      if (/\bsrc\s*=/i.test(attrs)) return full;
      if (/type\s*=\s*["']?(?:module|application\/json|importmap)/i.test(attrs)) return full;
      return `<script${attrs}>${rewriteFenixCollectionCode(body)}</script>`;
    },
  );
}

/** Clothing/wardrobe briefs lock onto the token the runtime already accepts. */
export function collectionForBrief(brief: string, fallback = "voci"): string {
  const p = String(brief || "").toLowerCase();
  if (/\bvesti\b|\bguardaroba\b|\barmadio\b|\babiti?\b|\bcapi\b|\boutfit\b|\blookbook\b/.test(p)) {
    return FENIX_CANONICAL_CAPI;
  }
  return parseFenixCollection(fallback) || "voci";
}
