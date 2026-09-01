const SECRETISH =
  /(-----BEGIN[\s\S]+?-----END[^-]+-----)|(Bearer\s+[A-Za-z0-9._\-+/=]{12,})|(eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})|("private_key"\s*:\s*"[^"]+")|(sk-[A-Za-z0-9]{8,})|(nf_[A-Za-z0-9]{12,})|(ghs_[A-Za-z0-9._\-]{10,})|(github_pat_[A-Za-z0-9_]{10,})/g;

const SECRET_FLAGS = /^-{0,2}(storepass|keypass|storePassword|keyPassword|password)$/i;

export function redactSecrets(text: string): string {
  return String(text || "").replace(SECRETISH, "[redacted]");
}

export function redactArgs(args: string[]): string[] {
  const out = args.map((a) => String(a));
  for (let i = 0; i < out.length; i++) {
    if (SECRET_FLAGS.test(out[i]!) && out[i + 1]) {
      out[i + 1] = "[redacted]";
    }
  }
  return out.map((a) => redactSecrets(a));
}

export function looksLikeSecret(text: string): boolean {
  const s = String(text || "");
  if (/-----BEGIN/.test(s)) return true;
  if (/"private_key"\s*:/.test(s)) return true;
  if (/Bearer\s+[A-Za-z0-9._\-+/=]{12,}/.test(s)) return true;
  if (/\bghs_[A-Za-z0-9._\-]{10,}/.test(s)) return true;
  if (/\bgithub_pat_[A-Za-z0-9_]{10,}/.test(s)) return true;
  return false;
}

export function assertPublicLog(lines: string[]): void {
  for (const line of lines) {
    if (looksLikeSecret(line)) {
      throw new Error("log contains a secret");
    }
  }
}
