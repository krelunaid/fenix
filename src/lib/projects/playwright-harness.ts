import { readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const LOCAL_HOST = /^(127\.0\.0\.1|localhost|\[::1\]|::1)$/i;
const PLAYWRIGHT_CHROME_CMD = /ms-playwright/i;
const PLAYWRIGHT_CHROME_BIN = /chrome-headless-shell|headless_shell|chromium/i;
const PLAYWRIGHT_TMP =
  /^(playwright_chromiumdev_profile-|playwright-artifacts-)/;
const SHELL_COMM = /^(bash|sh|dash|zsh|fish|node|python|python3|corepack|pnpm|npm)$/i;
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
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
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

/**
 * Playwright's headless shell lives under `ms-playwright`. Matching a bare
 * `chrome-headless-shell` string is not enough: a parent bash/node cmdline can
 * quote that token (this sandbox's wrapper does) and must never be SIGKILL'd.
 */
export function isPlaywrightChromiumProcess(cmdline: string, comm = ""): boolean {
  const name = comm.trim().split(/[\r\n]/)[0] ?? "";
  if (name && SHELL_COMM.test(name)) return false;
  return PLAYWRIGHT_CHROME_CMD.test(cmdline) && PLAYWRIGHT_CHROME_BIN.test(cmdline);
}

export function isPlaywrightChromiumCmdline(cmdline: string): boolean {
  return isPlaywrightChromiumProcess(cmdline);
}

export function sweepStaleChromium(deps?: {
  procDir?: string;
  tmpDir?: string;
  kill?: (pid: number, signal: NodeJS.Signals) => void;
  selfPid?: number;
  ppid?: number;
}): { killed: number; removedDirs: number } {
  const procDir = deps?.procDir ?? "/proc";
  const tmpDir = deps?.tmpDir ?? tmpdir();
  const selfPid = deps?.selfPid ?? process.pid;
  const ppid = deps?.ppid ?? process.ppid;
  const kill =
    deps?.kill ??
    ((pid, signal) => {
      process.kill(pid, signal);
    });
  let killed = 0;
  let removedDirs = 0;
  try {
    for (const entry of readdirSync(procDir)) {
      const pid = Number.parseInt(entry, 10);
      if (!Number.isInteger(pid) || pid <= 1 || pid === selfPid || pid === ppid) continue;
      let cmdline = "";
      let comm = "";
      try {
        cmdline = readFileSync(join(procDir, entry, "cmdline"), "utf8");
      } catch {
        continue;
      }
      try {
        comm = readFileSync(join(procDir, entry, "comm"), "utf8");
      } catch {
        comm = "";
      }
      if (!isPlaywrightChromiumProcess(cmdline, comm)) continue;
      try {
        kill(pid, "SIGKILL");
        killed += 1;
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* /proc may be missing on some hosts */
  }
  try {
    for (const name of readdirSync(tmpDir)) {
      if (!PLAYWRIGHT_TMP.test(name)) continue;
      try {
        rmSync(join(tmpDir, name), { recursive: true, force: true });
        removedDirs += 1;
      } catch {
        /* still in use */
      }
    }
  } catch {
    /* tmp unreadable */
  }
  return { killed, removedDirs };
}

export async function launchChromiumWith(
  launch: () => Promise<Browser>,
  opts?: { sweep?: () => void | Promise<void> },
): Promise<Browser> {
  try {
    return await launch();
  } catch (err) {
    if (!isTransientLaunchError(err)) throw err;
    await opts?.sweep?.();
    return launch();
  }
}

function instrumentBrowser(browser: Browser): Browser {
  const origPage = browser.newPage.bind(browser);
  const origContext = browser.newContext.bind(browser);
  const origClose = browser.close.bind(browser);
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
    try {
      await withTimeout(origClose(options), CLOSE_TIMEOUT_MS, "browser.close");
    } catch {
      sweepStaleChromium();
    }
  }) as Browser["close"];
  return browser;
}

/**
 * Fresh Chromium per call. Leftover Playwright processes/profiles are swept
 * before spawn so a previous hung close cannot starve the next launch.
 * Spawn is bounded and retried once after another sweep. `close()` is also
 * bounded so a hung CDP session cannot pin node:test.
 */
export async function launchChromium(): Promise<Browser> {
  sweepStaleChromium();
  return launchChromiumWith(
    async () => {
      const browser = await chromium.launch({
        headless: true,
        args: [...CHROMIUM_ARGS],
        timeout: LAUNCH_TIMEOUT_MS,
      });
      return instrumentBrowser(browser);
    },
    {
      sweep: () => {
        sweepStaleChromium();
      },
    },
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
