import assert from "node:assert/strict";
import { crispAppMarkSvg } from "../src/lib/projects/premium-mark.ts";
import { launchChromium } from "../src/lib/projects/playwright-harness.ts";
const browser = await launchChromium();
try {
  const page = await browser.newPage({ viewport: { width: 700, height: 260 } });
  const fixed = crispAppMarkSvg("note", "Note");
  const old = fixed.replace('<g fill="none" color="#E0F2FE"', '<g fill="#E0F2FE"');
  await page.setContent(`<body style="font:16px system-ui;background:#fff;color:#172033;display:flex;gap:64px;padding:32px"><section>Prima<div>${old}</div></section><section>Dopo<div>${fixed.replaceAll('note','fixed')}</div></section><style>svg{width:96px;height:96px}section>div{margin-top:20px}</style>`);
  assert.equal(await page.locator('section:last-of-type g').evaluate(el => getComputedStyle(el).fill), 'none');
  await page.screenshot({ path: '/tmp/fenix-icon-legibility-20260906.png' });
  console.log('Icon comparison: /tmp/fenix-icon-legibility-20260906.png');
} finally { await browser.close(); }
