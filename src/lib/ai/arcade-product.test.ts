import assert from "node:assert/strict";
import { test } from "node:test";
import { composeProduct } from "./compose-product.ts";
import { productIntent } from "./product-intent.ts";
import { planContract, evaluateContract } from "./build-contract.ts";
import { prepareSrcDoc } from "../projects/color-scheme.ts";
import { launchChromium, isolatedPage } from "../projects/playwright-harness.ts";
import { mkdirSync } from "node:fs";
import { contrastRatioRgb, parseCssColor } from "../projects/visual-quality.ts";
import { isClipFeedBrief } from "../projects/infer.ts";
import { looksLikeClipFeedBrief } from "../../../workers/visual/composed-create.mjs";

const brief="FORMATO: app telefono 390×844. kind=app. Tab in basso, 5 schermate. NON un sito.\nmi crei un app di videogiochi";
test("product plan distinguishes a playable arcade from a shop or website",()=>{
  for (const classify of [isClipFeedBrief, looksLikeClipFeedBrief]) {
    assert.equal(classify(brief),false,"videogiochi are not a short-video feed");
    assert.equal(classify("app di video verticali"),true);
  }
  const plan=productIntent(brief,"app")!;
  assert.equal(plan.domain,"arcade");
  assert.equal(plan.screens.length,5);
  assert.equal(productIntent("sito web videogiochi","site"),null);
  assert.equal(productIntent("app recensioni videogiochi","app"),null);
  const p=composeProduct(brief);
  assert.doesNotMatch(p.html,/<title>Note<\/title>/);
  assert.deepEqual(planContract(brief).screens,plan.screens);
  assert.equal(evaluateContract({html:p.html,contract:planContract(brief),brief}).ok,true);
  const broken=evaluateContract({html:p.html.replace('data-screen="gioca"','data-screen="altro"'),contract:planContract(brief),brief});
  assert.equal(broken.ok,false);
  assert.ok(broken.checks.some(c=>c.id==='product-screens'&&!c.ok));
});

test("arcade plays, persists, reloads, retries rejected saves and renders at four widths",{timeout:60000},async()=>{
  const browser=await launchChromium();
  const page=await isolatedPage(browser,{viewport:{width:390,height:844}});
  const errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  const p=composeProduct(brief);
  const srcdoc=prepareSrcDoc(p.html,p.tokens.palette,"arcade-fixture","app");
  try{
    await page.setContent(`<style>body{margin:0}iframe{border:0;width:100%;height:100vh}</style><iframe id="app"></iframe><script>window.db={};window.fail=false;addEventListener('message',function(e){var m=e.data;if(!m||m.t!=='fenix-db')return;if(m.op==='save'&&!window.fail)window.db[m.col]=m.data;e.source.postMessage({t:'fenix-db',id:m.id,v:m.op==='load'?(window.db[m.col]||null):{ok:!window.fail}},'*')});</script>`);
    const mount=async()=>{await page.locator('iframe').evaluate((el,html)=>(el as HTMLIFrameElement).srcdoc=html,srcdoc);await page.frameLocator('iframe').locator('[data-fenix-ready]').waitFor({state:'attached'})};
    await mount();
    const f=page.frameLocator('iframe');
    const navColors=await f.locator('nav [aria-current]').evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el.parentElement!).backgroundColor}));
    assert.ok(contrastRatioRgb(parseCssColor(navColors.fg)!,parseCssColor(navColors.bg)!)>=4.5,'active navigation contrast');
    const shots=process.env.FENIX_ARCADE_SHOTS;
    if(shots)mkdirSync(shots,{recursive:true});
    for(const width of [320,390,768,1280]){
      await page.setViewportSize({width,height:844});
      assert.equal(await f.locator('html').evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      if(shots)await page.screenshot({path:shots+'/arcade-'+width+'.png'});
    }
    await page.setViewportSize({width:390,height:844});
    await f.getByRole('button',{name:'Salva preferito',exact:true}).first().click();
    await f.locator('#notice').filter({hasText:'Salvato'}).waitFor();
    await mount();
    await f.locator('nav [data-view="preferiti"]').click();
    assert.equal(await f.locator('#favorites article').count(),1);
    await f.getByRole('button',{name:'Gioca a Coppie',exact:true}).click();
    await f.locator('html').evaluate(()=>{Math.random=()=>0});
    await f.getByRole('button',{name:'Inizia partita',exact:true}).click();
    for(const [a,b] of [[0,4],[1,5],[2,6],[3,7]]){
      await f.locator('[data-card="'+a+'"]').click();
      await f.locator('[data-card="'+b+'"]').click();
    }
    await f.locator('#result').filter({hasText:'Partita conclusa: 4 mosse'}).waitFor();
    await f.locator('#notice').filter({hasText:'Salvato'}).waitFor();
    await mount();
    await f.locator('nav [data-view="record"]').click();
    assert.match(await f.locator('#records').innerText(),/4 mosse/);
    await f.locator('nav [data-view="impostazioni"]').click();
    await page.evaluate(()=>{(window as any).fail=true});
    await f.getByLabel('Nome giocatore').fill('Ada');
    await f.getByRole('button',{name:'Salva nome'}).click();
    await f.locator('#notice').filter({hasText:'Non salvato'}).waitFor();
    assert.equal(await f.getByLabel('Nome giocatore').inputValue(),'Ada');
    await page.evaluate(()=>{(window as any).fail=false});
    await f.getByRole('button',{name:'Salva nome'}).click();
    await f.locator('#notice').filter({hasText:'Salvato'}).waitFor();
    await mount();
    await f.locator('nav [data-view="impostazioni"]').click();
    assert.equal(await f.getByLabel('Nome giocatore').inputValue(),'Ada');
    await f.locator('nav [data-view="scopri"]').click();
    await f.getByRole('button',{name:'Gioca a Riflessi'}).click();
    await f.getByRole('button',{name:'Inizia partita'}).click();
    await f.locator('#reflex.ready').waitFor();
    await f.locator('#reflex').click();
    await f.locator('#result').filter({hasText:'Partita conclusa'}).waitFor();
    assert.deepEqual(errors,[]);
  }finally{await page.close();await browser.close()}
});
