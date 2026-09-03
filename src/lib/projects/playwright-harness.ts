import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";

export const CHROMIUM_ARGS = ["--no-sandbox", "--disable-dev-shm-usage"] as const;
/** Playwright's own launch default. Explicit so a hung spawn cannot pin the suite. */
export const LAUNCH_TIMEOUT_MS = 30_000;
export const CLOSE_TIMEOUT_MS = 5_000;
/** Bounded pause before the single transient retry. Not a launch-timeout bump. */
export const RETRY_BACKOFF_MS = 50;
export const FENIX_PLAYWRIGHT_ROOT_NAME = "fenix-playwright";

const LOCAL_HOST = /^(127\.0\.0\.1|localhost|\[::1\]|::1)$/i;
const TRANSIENT_LAUNCH =
  /Timeout|timed out|Target closed|Failed to launch|EPIPE|ECONNRESET|spawn |browser has been closed|Protocol error/i;

/**
 * Public origins that product HTML and Studio pull during tests.
 * A hung TCP/DNS to these keeps Playwright on `domcontentloaded` far
 * past the declared timeout (reproduced: setContent 15s while jsdelivr
 * never completes; aborting the same URLs returns in ~30ms).
 *
 * Studio `__root.tsx` also injects fonts.googleapis.com on every /studio
 * navigation. Unisolated browser tests (revisions, site-repair, …) then
 * stall the same way — Versioni/overlay never become actionable.
 */
export const PUBLIC_TEST_BLOCK =
  /fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com|fenix-production-d9f5\.up\.railway\.app/i;

type Routable = Page | BrowserContext;

export type OwnedLaunch = {
  token: string;
  pid: number;
  dir: string;
  root: string;
};

const owned = new Map<string, OwnedLaunch>();
const browserOwned = new WeakMap<Browser, OwnedLaunch>();
let runRoot: string | undefined;
let lease: Promise<void> = Promise.resolve();

export function isBlockedPublicNetworkError(text: string): boolean {
  return PUBLIC_TEST_BLOCK.test(text) || /ERR_BLOCKED_BY_CLIENT|NS_ERROR_ABORT/i.test(text);
}

export function isLocalTestUrl(url: string): boolean {
  if (!url) return false;
  if (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("about:") ||
    url.startsWith("file:")
  ) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "ws:" ||
      parsed.protocol === "wss:" ||
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    ) {
      return LOCAL_HOST.test(parsed.hostname);
    }
  } catch {
    return false;
  }
  return false;
}

function visualWorkPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return (
    p === "/api/build" ||
    p === "/api/polish" ||
    p === "/__worker/build" ||
    p === "/__worker/polish" ||
    p === "/build" ||
    p === "/polish"
  );
}

function jobPath(pathname: string): boolean {
  return /\/jobs\//.test(pathname);
}

/**
 * Abort non-local requests and `fallback()` local ones so later `page.route`
 * mocks still win (last registered + fallback to earlier handlers).
 *
 * Stylesheets are fulfilled, not aborted: Chromium treats an in-flight
 * render-blocking CSS (Studio's Google Fonts link) as a reason to delay
 * first paint / hydration. Abort can leave `hidden md:block` unpainted
 * so overlay/Versioni waitFor(visible) expires. Empty CSS unblocks paint.
 *
 * Must not `continue()` local URLs: that would skip job/polish stubs.
 * Must not `new Promise(() => {})` in a route: pending handlers pin Chromium.
 */
export async function isolateFromPublicNetwork(target: Routable): Promise<void> {
  await target.route("**/*", async (route) => {
    const url = route.request().url();
    if (isLocalTestUrl(url)) {
      await route.fallback();
      return;
    }
    if (/fonts\.googleapis\.com/i.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: "text/css; charset=utf-8",
        body: "/* fenix-test: webfonts omitted */",
      });
      return;
    }
    if (/fonts\.gstatic\.com/i.test(url)) {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.abort("blockedbyclient");
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolvePromise(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function isTransientLaunchError(err: unknown): boolean {
  if (!err) return false;
  const name = err instanceof Error ? err.name : "";
  if (name === "AssertionError") return false;
  const msg = err instanceof Error ? err.message : String(err);
  return TRANSIENT_LAUNCH.test(msg);
}

/** Serialise in-process launch and close so two Chromium spawns cannot overlap. */
export function withChromiumLease<T>(fn: () => Promise<T>): Promise<T> {
  const run = lease.then(fn, fn);
  lease = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function fenixPlaywrightRoot(): string {
  if (runRoot) return runRoot;
  const base = join(
    tmpdir(),
    FENIX_PLAYWRIGHT_ROOT_NAME,
    `${process.pid}-${randomBytes(4).toString("hex")}`,
  );
  mkdirSync(base, { recursive: true, mode: 0o700 });
  runRoot = realpathSync(base);
  return runRoot;
}

/**
 * Resolve `candidate` only if it stays inside `root` after normalize + realpath.
 * Symlinks and `..` that leave the dedicated Fenix tmp are rejected.
 */
export function resolveInsideRoot(root: string, candidate: string): string {
  if (!root || !candidate) throw new Error("fenix playwright path required");
  const rootReal = realpathSync(root);
  const abs = isAbsolute(candidate) ? candidate : resolve(rootReal, candidate);
  const lex = normalize(abs);
  const relLex = relative(rootReal, lex);
  if (relLex.startsWith("..") || isAbsolute(relLex)) {
    throw new Error("path escapes fenix playwright root");
  }
  if (existsSync(lex)) {
    const st = lstatSync(lex);
    if (st.isSymbolicLink()) {
      throw new Error("path escapes fenix playwright root");
    }
    const real = realpathSync(lex);
    const relReal = relative(rootReal, real);
    if (relReal.startsWith("..") || isAbsolute(relReal)) {
      throw new Error("path escapes fenix playwright root");
    }
    return real;
  }
  return lex;
}

export function registerOwnedLaunch(record: OwnedLaunch): void {
  owned.set(record.token, record);
}

export function unregisterOwnedLaunch(token: string): void {
  owned.delete(token);
}

export function ownedLaunch(token: string): OwnedLaunch | undefined {
  return owned.get(token);
}

export function parseProcessArgsTable(dump: string): { pid: number; args: string }[] {
  const rows: { pid: number; args: string }[] = [];
  for (const line of dump.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sp = trimmed.search(/\s+/);
    if (sp <= 0) continue;
    const pid = Number.parseInt(trimmed.slice(0, sp), 10);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    rows.push({ pid, args: trimmed.slice(sp).trim() });
  }
  return rows;
}

function snapshotProcessArgs(): { pid: number; args: string }[] {
  try {
    const dump = execFileSync("ps", ["-Ao", "pid=,args="], {
      encoding: "utf8",
      timeout: 2000,
    });
    const rows = parseProcessArgsTable(dump);
    if (rows.length) return rows;
  } catch {
    /* ps missing (some sandboxes) */
  }
  const rows: { pid: number; args: string }[] = [];
  try {
    for (const entry of readdirSync("/proc")) {
      const pid = Number.parseInt(entry, 10);
      if (!Number.isInteger(pid) || pid <= 1) continue;
      try {
        const args = readFileSync(join("/proc", entry, "cmdline"), "utf8").replace(/\0/g, " ");
        rows.push({ pid, args });
      } catch {
        continue;
      }
    }
  } catch {
    /* no /proc (macOS) */
  }
  return rows;
}

/** Pid whose argv contains this instance's dedicated dir. Never matches by a global chrome pattern. */
export function pidOwningDir(
  dir: string,
  rows?: { pid: number; args: string }[],
  deps?: { selfPid?: number; ppid?: number },
): number {
  if (!dir) return 0;
  const selfPid = deps?.selfPid ?? process.pid;
  const ppid = deps?.ppid ?? process.ppid;
  for (const row of rows ?? snapshotProcessArgs()) {
    if (row.pid <= 1 || row.pid === selfPid || row.pid === ppid) continue;
    if (row.args.includes(dir)) return row.pid;
  }
  return 0;
}

function killOwnedPid(
  pid: number,
  deps: {
    kill: (pid: number, signal: NodeJS.Signals) => void;
    selfPid: number;
    ppid: number;
  },
): boolean {
  if (!Number.isInteger(pid) || pid <= 1 || pid === deps.selfPid || pid === deps.ppid) {
    return false;
  }
  try {
    deps.kill(pid, "SIGKILL");
    return true;
  } catch {
    return false;
  }
}

/**
 * Drop only this harness-owned pid and its directory. Never scans a process
 * table or the host tmpdir; foreign Playwright profiles/processes are untouched.
 */
export function sweepOwnedLaunch(
  record: OwnedLaunch,
  deps?: {
    kill?: (pid: number, signal: NodeJS.Signals) => void;
    selfPid?: number;
    ppid?: number;
  },
): { killed: boolean; removed: boolean } {
  const kill =
    deps?.kill ??
    ((pid, signal) => {
      process.kill(pid, signal);
    });
  const selfPid = deps?.selfPid ?? process.pid;
  const ppid = deps?.ppid ?? process.ppid;
  const safe = resolveInsideRoot(record.root, record.dir);
  const killed = killOwnedPid(record.pid, { kill, selfPid, ppid });
  let removed = false;
  try {
    rmSync(safe, { recursive: true, force: true });
    removed = true;
  } catch {
    /* already gone */
  }
  unregisterOwnedLaunch(record.token);
  return { killed, removed };
}

export async function launchChromiumWith(
  launch: () => Promise<Browser>,
  opts?: { onTransient?: () => void | Promise<void>; backoffMs?: number },
): Promise<Browser> {
  try {
    return await launch();
  } catch (err) {
    if (!isTransientLaunchError(err)) throw err;
    await opts?.onTransient?.();
    const wait = Math.max(0, Math.min(opts?.backoffMs ?? RETRY_BACKOFF_MS, 200));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    return launch();
  }
}

function instrumentBrowser(browser: Browser, record: OwnedLaunch): Browser {
  const origPage = browser.newPage.bind(browser);
  const origContext = browser.newContext.bind(browser);
  const origClose = browser.close.bind(browser);
  let closing = false;
  browser.newPage = (async (options?: Parameters<Browser["newPage"]>[0]) => {
    const page = await origPage(options);
    await isolateFromPublicNetwork(page);
    return page;
  }) as Browser["newPage"];
  browser.newContext = (async (options?: Parameters<Browser["newContext"]>[0]) => {
    const context = await origContext(options);
    await isolateFromPublicNetwork(context);
    return context;
  }) as Browser["newContext"];
  browser.close = (async (options?: { reason?: string }) => {
    if (closing) return;
    closing = true;
    await withChromiumLease(async () => {
      try {
        await withTimeout(origClose(options), CLOSE_TIMEOUT_MS, "browser.close");
      } catch {
        /* hung CDP — owned pid/dir still get swept below */
      } finally {
        sweepOwnedLaunch(record);
      }
    });
  }) as Browser["close"];
  browserOwned.set(browser, record);
  return browser;
}

async function spawnOwned(): Promise<Browser> {
  const root = fenixPlaywrightRoot();
  const token = randomBytes(8).toString("hex");
  const dir = join(root, token);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const safeDir = resolveInsideRoot(root, dir);
  const record: OwnedLaunch = { token, pid: 0, dir: safeDir, root };
  registerOwnedLaunch(record);
  const prevTmp = process.env.TMPDIR;
  process.env.TMPDIR = safeDir;
  try {
    const browser = await chromium.launch({
      headless: true,
      args: [...CHROMIUM_ARGS],
      timeout: LAUNCH_TIMEOUT_MS,
      downloadsPath: join(safeDir, "downloads"),
    });
    record.pid = pidOwningDir(safeDir);
    return instrumentBrowser(browser, record);
  } catch (err) {
    sweepOwnedLaunch(record);
    throw err;
  } finally {
    if (prevTmp === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = prevTmp;
  }
}

/**
 * Fresh Chromium per call, spawned under a dedicated Fenix tmp root.
 * Launch and close share an in-process lease. One transient retry with
 * bounded backoff. close() is bounded; leftover cleanup is only the pid
 * and directory registered for that instance.
 */
export async function launchChromium(): Promise<Browser> {
  return withChromiumLease(() =>
    launchChromiumWith(() => spawnOwned(), { backoffMs: RETRY_BACKOFF_MS }),
  );
}

export async function isolatedPage(
  browser: Browser,
  options?: Parameters<Browser["newPage"]>[0],
): Promise<Page> {
  const page = await browser.newPage(options);
  // newPage from launchChromium is already isolated; this second pass
  // covers a raw Playwright browser passed in by older helpers.
  await isolateFromPublicNetwork(page);
  return page;
}

/**
 * Keep Studio in "building" without a pending route handler.
 * Fulfilling 202 + job=run is the same product state as a hung worker,
 * without pinning Chromium on `new Promise(() => {})`.
 *
 * Matches same-origin `/api` + `/__worker` and the Railway `/build|/polish`
 * fallbacks in `run-build.ts` so an aborted public POST cannot flip the
 * overlay from building to error.
 */
export async function holdVisualWork(page: Page, jobId = "job-hold"): Promise<void> {
  await page.route(
    (url) => visualWorkPath(url.pathname),
    async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({ id: jobId, status: "run" }),
        });
        return;
      }
      await route.fulfill({ status: 204, body: "" });
    },
  );
  await page.route(
    (url) => jobPath(url.pathname),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: jobId, status: "run", html: null }),
      });
    },
  );
}
