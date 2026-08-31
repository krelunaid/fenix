import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

async function isUp(url: string): Promise<boolean> {
  try {
    const health = await fetch(`${url.replace(/\/$/, "")}/`, { signal: AbortSignal.timeout(1500) });
    return health.ok;
  } catch {
    return false;
  }
}

/** Fail hard — never skip Studio tests when preview is down. */
export async function requirePreview(): Promise<string> {
  const url = process.env.PREVIEW_URL || "http://127.0.0.1:8081";
  if (await isUp(url)) return url;
  await execFileAsync("npm", ["run", "preview:restart"], {
    cwd: ROOT,
    timeout: 90000,
  });
  const start = Date.now();
  while (Date.now() - start < 60000) {
    if (await isUp(url)) return url;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`PREVIEW_REQUIRED: ${url} non in ascolto dopo preview:restart`);
}
