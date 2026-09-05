/** Safari srcdoc + cross-origin tags sanitize real throws to this. */
export function isOpaquePreviewError(message: unknown): boolean {
  const msg = String(message || "").trim();
  return !msg || /^error$/i.test(msg) || /^script error\.?$/i.test(msg);
}
