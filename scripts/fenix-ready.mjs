/** Deterministic hydration gate for demo / product screenshots. */

export const FENIX_READY_ATTR = "data-fenix-ready";
export const FENIX_READY_SELECTOR = "[data-fenix-ready]";
export const FENIX_READY_SNIPPET =
  'document.documentElement.setAttribute("data-fenix-ready","1")';

export const BEFORE_READY_ERROR =
  "Fenix ready marker missing: cannot screenshot before hydration";

/**
 * Product JS that marks the document ready AFTER the first hydrated render.
 * Demos must call this at the end of boot(), never before Fenix.load/render.
 */
export const MARK_READY_JS = `function markReady(){${FENIX_READY_SNIPPET}}`;

/**
 * Wait until the product has hydrated and painted. Throws if the marker
 * never appears — callers must not fall back to a blind timeout screenshot.
 */
export async function waitForFenixReady(page, timeout = 8000) {
  const found = await page.$(FENIX_READY_SELECTOR);
  if (found) return;
  try {
    await page.waitForSelector(FENIX_READY_SELECTOR, {
      timeout,
      state: "attached",
    });
  } catch {
    throw new Error(BEFORE_READY_ERROR);
  }
}

/** Screenshot only after the ready marker. Never call page.screenshot first. */
export async function screenshotWhenReady(page, path, timeout = 8000) {
  await waitForFenixReady(page, timeout);
  try {
    await page.evaluate(() =>
      document.fonts && document.fonts.ready ? document.fonts.ready : null,
    );
  } catch {
    /* fonts optional */
  }
  return page.screenshot({ path, fullPage: false, type: "png" });
}
