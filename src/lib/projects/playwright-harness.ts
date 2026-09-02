import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";

export const CHROMIUM_ARGS = ["--no-sandbox", "--disable-dev-shm-usage"] as const;

const LOCAL_HOST = /^(127\.0\.0\.1|localhost|\[::1\]|::1)$/i;

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

function instrumentBrowser(browser: Browser): Browser {
  const origPage = browser.newPage.bind(browser);
  const origContext = browser.newContext.bind(browser);
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
  return browser;
}

export async function launchChromium(): Promise<Browser> {
  const browser = await chromium.launch({
    headless: true,
    args: [...CHROMIUM_ARGS],
  });
  return instrumentBrowser(browser);
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
