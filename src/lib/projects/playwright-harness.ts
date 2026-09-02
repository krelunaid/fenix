import { chromium, type Browser, type Page } from "playwright";

export const CHROMIUM_ARGS = ["--no-sandbox", "--disable-dev-shm-usage"] as const;

const LOCAL_HOST = /^(127\.0\.0\.1|localhost|\[::1\]|::1)$/i;

/**
 * Public origins that product HTML and Studio pull during tests.
 * A hung TCP/DNS to these keeps Playwright on `domcontentloaded` far
 * past the declared timeout (reproduced: setContent 15s while jsdelivr
 * never completes; aborting the same URLs returns in ~30ms).
 */
export const PUBLIC_TEST_BLOCK =
  /fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com|fenix-production-d9f5\.up\.railway\.app/i;

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
    if (parsed.protocol === "ws:" || parsed.protocol === "wss:" || parsed.protocol === "http:" || parsed.protocol === "https:") {
      return LOCAL_HOST.test(parsed.hostname);
    }
  } catch {
    return false;
  }
  return false;
}

export function launchChromium(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: [...CHROMIUM_ARGS],
  });
}

/**
 * Abort non-local requests and `fallback()` local ones so later `page.route`
 * mocks still win (last registered + fallback to earlier handlers).
 *
 * Must not `continue()` local URLs: that would skip job/polish stubs.
 * Must not `new Promise(() => {})` in a route: pending handlers pin Chromium.
 */
export async function isolateFromPublicNetwork(page: Page): Promise<void> {
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (isLocalTestUrl(url)) {
      await route.fallback();
      return;
    }
    await route.abort("blockedbyclient");
  });
}

export async function isolatedPage(
  browser: Browser,
  options?: Parameters<Browser["newPage"]>[0],
): Promise<Page> {
  const page = await browser.newPage(options);
  await isolateFromPublicNetwork(page);
  return page;
}

/**
 * Keep Studio in "building" without a pending route handler.
 * Fulfilling 202 + job=run is the same product state as a hung worker,
 * without pinning Chromium on `new Promise(() => {})`.
 */
export async function holdVisualWork(page: Page, jobId = "job-hold"): Promise<void> {
  await page.route(/\/(api\/build|api\/polish|__worker\/(?:build|polish)(?:\/|$|\?))/, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ id: jobId, status: "run" }),
      });
      return;
    }
    await route.fulfill({ status: 204, body: "" });
  });
  await page.route(/\/jobs\//, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: jobId, status: "run", html: null }),
    });
  });
}
