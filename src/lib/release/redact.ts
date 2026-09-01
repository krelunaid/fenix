const SECRETISH =
  /(-----BEGIN[\s\S]+?-----END[^-]+-----)|(Bearer\s+[A-Za-z0-9._\-+/=]{12,})|(eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})|("private_key"\s*:\s*"[^"]+")|(sk-[A-Za-z0-9]{8,})|(nf_[A-Za-z0-9]{12,})/g;

export function redactSecrets(text: string): string {
  return String(text || "").replace(SECRETISH, "[redacted]");
}

export function looksLikeSecret(text: string): boolean {
  const s = String(text || "");
  if (/-----BEGIN/.test(s)) return true;
  if (/"private_key"\s*:/.test(s)) return true;
  if (/Bearer\s+[A-Za-z0-9._\-+/=]{12,}/.test(s)) return true;
  return false;
}

export function assertPublicLog(lines: string[]): void {
  for (const line of lines) {
    if (looksLikeSecret(line)) {
      throw new Error("log contains a secret");
    }
  }
}
