/**
 * Shared Fenix collection token. Runtime, cloud store, planner and HTML gate
 * must agree: never widen this regex, never accept traversal or reserved keys.
 * Adapter/Fenix.data stay fail-closed — they do not slugify user input.
 */
export const FENIX_COLLECTION_RE = /^[A-Za-z0-9._-]{1,80}$/;
export const FENIX_COLLECTION_FORBIDDEN = ["__proto__", "prototype", "constructor"] as const;

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

/**
 * Planner/parser only. Maps a brief label onto a legal token.
 * Rejects traversal; never used at the Fenix.data runtime boundary.
 * Returns null when the value cannot become a legal token without widening.
 */
export function slugFenixCollection(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw || /[/\\]|\.\./.test(raw)) return null;
  const exact = parseFenixCollection(raw);
  if (exact) return exact;
  const slug = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 80);
  return parseFenixCollection(slug);
}

export function normalizeFenixCollection(value: unknown, fallback = "voci"): string {
  return slugFenixCollection(value) || parseFenixCollection(fallback) || "voci";
}

const DATA_CALL =
  /\b(?:window\.)?Fenix\.data\.(?:query|list|get|insert|update|remove)\s*\(\s*(["'`])([^"'`]*)\1/g;
const LOAD_CALL = /\b(?:window\.)?Fenix\.(?:load|save)\s*\(\s*(["'`])([^"'`]*)\1/g;

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
  for (const re of [DATA_CALL, LOAD_CALL]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    const api: FenixCollectionHit["api"] = re === DATA_CALL ? "data" : "load";
    while ((match = re.exec(src))) push(api, match[2] ?? "");
  }
  return hits;
}

export function invalidFenixCollectionError(code: string): string {
  const bad = extractFenixCollectionHits(code).find((hit) => !hit.valid);
  if (!bad) return "";
  return `Fenix.data: collezione non valido ("${bad.raw.slice(0, 80)}")`;
}

/** Clothing/wardrobe briefs lock onto the token the runtime already accepts. */
export function collectionForBrief(brief: string, fallback = "voci"): string {
  const p = String(brief || "").toLowerCase();
  if (/\bvesti\b|\bguardaroba\b|\barmadio\b|\babiti?\b|\bcapi\b|\boutfit\b|\blookbook\b/.test(p)) {
    return "capi";
  }
  return parseFenixCollection(fallback) || "voci";
}
