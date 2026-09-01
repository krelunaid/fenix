import { mkdtempSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Materialize AuthKey_{keyId}.p8 for Transporter/altool. Always unlink. Never log. */
export async function withAppleApiKey<T>(
  creds: { keyId: string; privateKey: string },
  fn: (env: { API_PRIVATE_KEYS_DIR: string }) => Promise<T>,
): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "fenix-asc-"));
  try {
    chmodSync(dir, 0o700);
    const file = join(dir, `AuthKey_${creds.keyId}.p8`);
    writeFileSync(file, creds.privateKey.replace(/\\n/g, "\n").trim() + "\n", { mode: 0o600 });
    chmodSync(file, 0o600);
    return await fn({ API_PRIVATE_KEYS_DIR: dir });
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
