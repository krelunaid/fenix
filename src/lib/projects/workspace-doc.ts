/**
 * Server-authoritative shared notes. Insert/delete with op id + base version.
 * Independent regions converge; overlapping or stale ops fail closed.
 * Not a CRDT and not a parity claim.
 */

export const DOC_OP_ID_RE = /^o[a-f0-9]{16,32}$/;
export const MAX_DOC_CHARS = 24_000;
export const MAX_DOC_INSERT = 2_000;
export const MAX_DOC_OPS = 64;

export type DocKind = "insert" | "delete";

export type ClientDocOp = {
  id: string;
  kind: DocKind;
  pos: number;
  text: string;
  base: number;
};

export type StoredDocOp = {
  id: string;
  kind: DocKind;
  pos: number;
  text: string;
  seq: number;
};

export type SharedDoc = {
  content: string;
  version: number;
  ops: StoredDocOp[];
};

export type DocDecision =
  | { status: "duplicate" }
  | { status: "reject"; error: string; http: 400 | 409 }
  | { status: "apply"; next: SharedDoc; stored: StoredDocOp };

export function emptySharedDoc(): SharedDoc {
  return { content: "", version: 0, ops: [] };
}

export function auditDocDetail(kind: DocKind, length: number): string {
  return `${kind} ${length}`;
}

export function parseDocOps(raw: string): StoredDocOp[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: StoredDocOp[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      const kind = rec.kind === "insert" || rec.kind === "delete" ? rec.kind : null;
      const id = String(rec.id || "");
      const pos = Number(rec.pos);
      const seq = Number(rec.seq);
      const text = typeof rec.text === "string" ? rec.text : "";
      if (!kind || !DOC_OP_ID_RE.test(id)) continue;
      if (!Number.isInteger(pos) || pos < 0) continue;
      if (!Number.isInteger(seq) || seq < 1) continue;
      out.push({ id, kind, pos, text, seq });
    }
    return out.sort((a, b) => a.seq - b.seq);
  } catch {
    return [];
  }
}

export function serializeDocOps(ops: StoredDocOp[]): string {
  return JSON.stringify(ops.slice(-MAX_DOC_OPS));
}

function parseKind(value: unknown): DocKind | null {
  return value === "insert" || value === "delete" ? value : null;
}

export function applyOp(
  content: string,
  op: Pick<ClientDocOp, "kind" | "pos" | "text">,
): { ok: true; content: string } | { ok: false; reason: string } {
  if (!Number.isInteger(op.pos) || op.pos < 0) return { ok: false, reason: "pos" };
  if (typeof op.text !== "string" || op.text.length < 1 || op.text.length > MAX_DOC_INSERT) {
    return { ok: false, reason: "text" };
  }
  if (op.kind === "insert") {
    if (op.pos > content.length) return { ok: false, reason: "pos" };
    const next = content.slice(0, op.pos) + op.text + content.slice(op.pos);
    if (next.length > MAX_DOC_CHARS) return { ok: false, reason: "size" };
    return { ok: true, content: next };
  }
  if (op.kind === "delete") {
    const end = op.pos + op.text.length;
    if (end > content.length) return { ok: false, reason: "range" };
    if (content.slice(op.pos, end) !== op.text) return { ok: false, reason: "mismatch" };
    return { ok: true, content: content.slice(0, op.pos) + content.slice(end) };
  }
  return { ok: false, reason: "kind" };
}

export function transformAgainst(
  op: Pick<ClientDocOp, "id" | "kind" | "pos" | "text">,
  other: StoredDocOp,
): { ok: true; op: Pick<ClientDocOp, "id" | "kind" | "pos" | "text"> } | { ok: false } {
  if (op.kind === "insert" && other.kind === "insert") {
    if (other.pos < op.pos || (other.pos === op.pos && other.id < op.id)) {
      return { ok: true, op: { ...op, pos: op.pos + other.text.length } };
    }
    return { ok: true, op };
  }
  if (op.kind === "insert" && other.kind === "delete") {
    const otherEnd = other.pos + other.text.length;
    if (otherEnd <= op.pos) return { ok: true, op: { ...op, pos: op.pos - other.text.length } };
    if (other.pos >= op.pos) return { ok: true, op };
    return { ok: false };
  }
  if (op.kind === "delete" && other.kind === "insert") {
    const opEnd = op.pos + op.text.length;
    if (other.pos <= op.pos) return { ok: true, op: { ...op, pos: op.pos + other.text.length } };
    if (other.pos >= opEnd) return { ok: true, op };
    return { ok: false };
  }
  const a1 = op.pos + op.text.length;
  const b1 = other.pos + other.text.length;
  if (b1 <= op.pos) return { ok: true, op: { ...op, pos: op.pos - other.text.length } };
  if (other.pos >= a1) return { ok: true, op };
  return { ok: false };
}

export function transformThrough(
  op: Pick<ClientDocOp, "id" | "kind" | "pos" | "text">,
  history: StoredDocOp[],
  base: number,
  current: number,
): { ok: true; op: Pick<ClientDocOp, "id" | "kind" | "pos" | "text"> } | { ok: false } {
  let cur = op;
  const needed = history
    .filter((row) => row.seq > base && row.seq <= current)
    .sort((a, b) => a.seq - b.seq);
  for (const other of needed) {
    const next = transformAgainst(cur, other);
    if (!next.ok) return { ok: false };
    cur = next.op;
  }
  return { ok: true, op: cur };
}

export function decideDocOp(doc: SharedDoc, input: ClientDocOp): DocDecision {
  if (doc.ops.some((row) => row.id === input.id)) return { status: "duplicate" };
  if (!DOC_OP_ID_RE.test(input.id)) {
    return { status: "reject", error: "Identificativo operazione non valido.", http: 400 };
  }
  const kind = parseKind(input.kind);
  if (!kind) return { status: "reject", error: "Operazione non valida.", http: 400 };
  if (!Number.isInteger(input.base) || input.base < 0) {
    return { status: "reject", error: "Versione di base non valida.", http: 400 };
  }
  if (input.base > doc.version) {
    return { status: "reject", error: "Operazione su versione futura.", http: 409 };
  }
  const have = new Set(doc.ops.map((row) => row.seq));
  for (let seq = input.base + 1; seq <= doc.version; seq += 1) {
    if (!have.has(seq)) {
      return { status: "reject", error: "Operazione troppo vecchia.", http: 409 };
    }
  }
  const raw: Pick<ClientDocOp, "id" | "kind" | "pos" | "text"> = {
    id: input.id,
    kind,
    pos: input.pos,
    text: input.text,
  };
  const transformed =
    input.base === doc.version ? { ok: true as const, op: raw } : transformThrough(raw, doc.ops, input.base, doc.version);
  if (!transformed.ok) {
    return { status: "reject", error: "Conflitto. Il documento non è cambiato.", http: 409 };
  }
  const applied = applyOp(doc.content, transformed.op);
  if (!applied.ok) {
    return { status: "reject", error: "Conflitto. Il documento non è cambiato.", http: 409 };
  }
  const stored: StoredDocOp = {
    id: input.id,
    kind: transformed.op.kind,
    pos: transformed.op.pos,
    text: transformed.op.text,
    seq: doc.version + 1,
  };
  return {
    status: "apply",
    stored,
    next: {
      content: applied.content,
      version: stored.seq,
      ops: [...doc.ops, stored].slice(-MAX_DOC_OPS),
    },
  };
}

/** Single-region prefix/suffix diff for a typing session. */
export function diffDocs(
  previous: string,
  next: string,
): { pos: number; deleted: string; inserted: string } | null {
  if (previous === next) return null;
  let i = 0;
  const maxPrefix = Math.min(previous.length, next.length);
  while (i < maxPrefix && previous.charCodeAt(i) === next.charCodeAt(i)) i += 1;
  let j = 0;
  while (
    j < previous.length - i &&
    j < next.length - i &&
    previous.charCodeAt(previous.length - 1 - j) === next.charCodeAt(next.length - 1 - j)
  ) {
    j += 1;
  }
  return {
    pos: i,
    deleted: previous.slice(i, previous.length - j),
    inserted: next.slice(i, next.length - j),
  };
}
