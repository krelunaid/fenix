import { slugify } from "../utils.ts";

/** Reverse-DNS bundle id. Not com.example / com.apple. */
export const BUNDLE_RE = /^[a-zA-Z][a-zA-Z0-9]{0,32}(\.[a-zA-Z][a-zA-Z0-9-]{0,32}){1,4}$/;
export const PACKAGE_RE = /^[a-z][a-z0-9_]{0,32}(\.[a-z][a-z0-9_]{0,32}){1,4}$/;

const RESERVED = /^(com\.example|com\.apple|android|io\.fenix\.test)(\.|$)/i;

export function suggestedBundleId(name: string): string {
  const slug = slugify(name).replace(/-/g, "").slice(0, 24) || "app";
  return `it.fenix.${slug}`;
}

export function suggestedPackageName(name: string): string {
  return suggestedBundleId(name).toLowerCase();
}

export function validateBundleId(raw: string): string | { error: string } {
  const id = String(raw || "").trim();
  if (!id) return { error: "Manca il bundle ID iOS." };
  if (!BUNDLE_RE.test(id)) {
    return { error: "Bundle ID non valido. Usa reverse-DNS, es. it.bottega.app." };
  }
  if (RESERVED.test(id)) return { error: "Bundle ID riservato. Scegline uno tuo." };
  return id;
}

export function validatePackageName(raw: string): string | { error: string } {
  const id = String(raw || "").trim().toLowerCase();
  if (!id) return { error: "Manca il package name Android." };
  if (!PACKAGE_RE.test(id)) {
    return { error: "Package name non valido. Solo minuscole, es. it.bottega.app." };
  }
  if (RESERVED.test(id)) return { error: "Package name riservato. Scegline uno tuo." };
  return id;
}

export function missingStoreRecord(id: string): boolean {
  return /\.missing\b/i.test(id) || /\.assente\b/i.test(id);
}
