/**
 * Server-side credit ledger for agent builds — the first place credits are
 * enforced outside the browser. Keyed by the owner hash (never the raw
 * capability). Netlify Blobs on Netlify, in-memory elsewhere (dev/tests).
 *
 * Grant and costs mirror src/lib/projects/credits.ts so the numbers the UI shows
 * stay meaningful; the server is the authority.
 */
import { createHash } from "node:crypto";

export const AGENT_CREDITS_STORE = "fenix-agent-credits";
export const AGENT_GRANT = 100;
export const AGENT_CREATE_COST = 4;
export const AGENT_EDIT_COST = 2;

export type Ledger = { remaining: number; grantedAt: number; spent: number; refunded: number };
type RefundMark = { at: number; amount: number };
type Charge = { amount: number; at: number };

export type LedgerStore = {
  get: (key: string, opts?: { type: "json" }) => Promise<unknown>;
  setJSON: (key: string, value: unknown) => Promise<void>;
};

export function ownerHash(ownerId: string): string {
  return createHash("sha256").update(`fenix-agent-owner:${ownerId}`).digest("hex");
}

function onNetlifyRuntime() {
  return Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT);
}

const memory = new Map<string, unknown>();
const memoryStore: LedgerStore = {
  async get(key) {
    return memory.has(key) ? memory.get(key) : null;
  },
  async setJSON(key, value) {
    memory.set(key, JSON.parse(JSON.stringify(value)));
  },
};

/** Test hook: wipe the in-memory ledger. */
export function resetMemoryLedger() {
  memory.clear();
}

let storeOverride: LedgerStore | null = null;
/** Test hook: inject a store (e.g. a fake Blobs store). */
export function setLedgerStoreForTests(store: LedgerStore | null) {
  storeOverride = store;
}

async function ledgerStore(): Promise<LedgerStore> {
  if (storeOverride) return storeOverride;
  if (!onNetlifyRuntime() && !process.env.NETLIFY_SITE_ID) return memoryStore;
  try {
    const mod = (await import("@netlify/blobs")) as {
      getStore?: (name: string | { name: string; consistency?: string }) => LedgerStore;
    };
    if (typeof mod.getStore !== "function") return memoryStore;
    try {
      return mod.getStore({ name: AGENT_CREDITS_STORE, consistency: "strong" });
    } catch {
      return mod.getStore(AGENT_CREDITS_STORE);
    }
  } catch (err) {
    console.error("[fenix-agent] netlify blobs unavailable, credits in memory", err);
    return memoryStore;
  }
}

function isLedger(v: unknown): v is Ledger {
  return Boolean(v && typeof v === "object" && typeof (v as Ledger).remaining === "number");
}

export async function readLedger(hash: string): Promise<Ledger> {
  const store = await ledgerStore();
  const raw = await store.get(`ledger:${hash}`, { type: "json" });
  if (isLedger(raw)) return raw;
  const fresh: Ledger = { remaining: AGENT_GRANT, grantedAt: Date.now(), spent: 0, refunded: 0 };
  await store.setJSON(`ledger:${hash}`, fresh);
  return fresh;
}

/**
 * Debit `amount` for `jobKey` and remember the charge, so a later refund knows
 * how much to give back. Returns the new ledger, or null when insufficient.
 */
export async function debit(hash: string, amount: number, jobKey: string): Promise<Ledger | null> {
  const store = await ledgerStore();
  const ledger = await readLedger(hash);
  if (ledger.remaining < amount) return null;
  const next: Ledger = { ...ledger, remaining: ledger.remaining - amount, spent: ledger.spent + amount };
  await store.setJSON(`ledger:${hash}`, next);
  await store.setJSON(`charge:${hash}:${jobKey}`, { amount, at: Date.now() } satisfies Charge);
  return next;
}

/** Re-key a charge record (provisional key → real job id). Balance is untouched. */
export async function moveCharge(hash: string, fromKey: string, toKey: string): Promise<void> {
  const store = await ledgerStore();
  const raw = (await store.get(`charge:${hash}:${fromKey}`, { type: "json" })) as Charge | null;
  if (!raw || typeof raw.amount !== "number") return;
  await store.setJSON(`charge:${hash}:${toKey}`, raw);
  await store.setJSON(`charge:${hash}:${fromKey}`, { amount: 0, at: raw.at } satisfies Charge);
}

/** Amount charged for a job, or 0 when unknown. */
export async function chargedFor(hash: string, jobKey: string): Promise<number> {
  const store = await ledgerStore();
  const raw = (await store.get(`charge:${hash}:${jobKey}`, { type: "json" })) as Charge | null;
  return raw && typeof raw.amount === "number" ? raw.amount : 0;
}

/** Refund once per job: a second call for the same job is a no-op. */
export async function refundOnce(hash: string, jobKey: string, amount: number): Promise<{ ledger: Ledger; refundedNow: boolean }> {
  const store = await ledgerStore();
  const markKey = `refund:${hash}:${jobKey}`;
  const existing = (await store.get(markKey, { type: "json" })) as RefundMark | null;
  const ledger = await readLedger(hash);
  if (existing && typeof existing.amount === "number") return { ledger, refundedNow: false };
  if (amount <= 0) return { ledger, refundedNow: false };
  const next: Ledger = { ...ledger, remaining: ledger.remaining + amount, refunded: ledger.refunded + amount };
  await store.setJSON(markKey, { at: Date.now(), amount } satisfies RefundMark);
  await store.setJSON(`ledger:${hash}`, next);
  return { ledger: next, refundedNow: true };
}
