import { applyVisualStylePlan } from './visual-style.mjs';

/**
 * Conservative static-chrome gate. Never executes generated scripts or contacts
 * app services. Dynamic-only targets cannot be proven here and fail closed.
 * This proves a visible computed change, NOT aesthetic quality or runtime CRUD.
 * @param {string} html @param {unknown} plan
 */
export async function verifyVisualStyleEffect(html, plan) {
  const styled = applyVisualStylePlan(html, plan);
  const { rules } = /** @type {{rules:Array<{selector:string,viewport?:string,declarations:Record<string,string>}>}} */ (plan);
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
    await context.route('**/*', route => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(4000);
    const found = rules.map(() => false);
    let changed = false;
    for (const [viewport, width, height] of /** @type {Array<[string,number,number]>} */ ([['mobile',390,844],['tablet',768,1024],['desktop',1280,800]])) {
      await page.setViewportSize({ width, height });
      /** @type {Array<Array<Array<{visible:boolean,values:string[]}>>>} */
      const snapshots = [];
      for (const source of [html, styled]) {
        await page.setContent(source, { waitUntil: 'domcontentloaded', timeout: 4000 });
        snapshots.push(await page.evaluate(({ rules, viewport }) => rules.map(rule => {
          if (rule.viewport && rule.viewport !== 'all' && rule.viewport !== viewport) return [];
          return Array.from(document.querySelectorAll(rule.selector)).map(node => {
            const style = getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            const visible = node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight;
            return { visible, values: Object.keys(rule.declarations).map(key => style.getPropertyValue(key)) };
          });
        }), { rules, viewport }));
      }
      rules.forEach((_, index) => {
        snapshots[0][index].forEach((before, nodeIndex) => {
          const after = snapshots[1][index][nodeIndex];
          if (!before.visible || !after?.visible) return;
          found[index] = true;
          if (before.values.some((value, propertyIndex) => value !== after.values[propertyIndex])) changed = true;
        });
      });
    }
    if (found.some(value => !value)) throw new Error('Target visuale assente o non verificabile senza eseguire l’app');
    if (!changed) throw new Error('Stile invariato: nessun effetto visibile verificato');
    return styled;
  } finally {
    await browser.close();
  }
}
