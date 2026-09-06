import assert from 'node:assert/strict';
import {test} from 'node:test';
import { COMPOSED_PLAN_DEGRADED_LOG } from '../workers/visual/composed-protocol.mjs';
import {
  canKeepComposedSeedAfterPolishError,
  repairVisualStyle,
  repairVisualStyleOrKeep,
  shouldSkipComposedPolish,
  VISUAL_STYLE_SKIPPED_LOG,
} from '../workers/visual/visual-style-repair.mjs';

const seed = '<!doctype html><html data-grammar="agenda"><head><style data-fenix-craft>:root{--accent:#225566}</style></head><body><nav id="tabs"><button>Home</button></nav><main id="root">acqua</main></body></html>';

test('rejected visual plans repair against the unchanged source, with two repairs maximum',async()=>{
  const source='<html>original</html>';
  let calls=0;
  const result=await repairVisualStyle(source,async feedback=>{
    calls++;
    if(calls===1){assert.equal(feedback,null);return '{';}
    assert.equal(feedback.attempt,calls-1);
    return JSON.stringify({value:calls===2?'13px':'28px'});
  },async(html,plan)=>{
    assert.equal(html,source);
    if(plan.value!=='28px')throw new Error('Stile non consentito: font-size');
    return 'verified';
  });
  assert.deepEqual(result,{html:'verified',repairs:2});
  assert.equal(calls,3);
  calls=0;
  await assert.rejects(repairVisualStyle(source,async()=>{calls++;return '{}';},async()=>{throw new Error('Stile non consentito: display');}),/Stile non consentito: display/);
  assert.equal(calls,3);
});

test('visual repair does not repeat uncertain transport calls or oversized plans',async()=>{
  for(const mode of ['transport','oversize']){
    let calls=0;
    await assert.rejects(repairVisualStyle('original',async()=>{
      calls++;
      if(mode==='transport')throw new Error('network interrupted');
      return 'x'.repeat(16001);
    },async()=>assert.fail('no verification without a usable plan')),mode==='transport'?/network interrupted/:/troppo grande/);
    assert.equal(calls,1);
  }
});

test('exhausted font-size rejection keeps the composed seed instead of failing closed',async()=>{
  let calls=0;
  const result=await repairVisualStyleOrKeep(seed,async()=>{
    calls++;
    return JSON.stringify({value:'13px'});
  },async()=>{
    throw new Error('Stile non consentito: font-size');
  });
  assert.equal(calls,3);
  assert.deepEqual(result,{html:seed,repairs:0,skipped:true,reason:'Stile non consentito: font-size'});
  assert.match(VISUAL_STYLE_SKIPPED_LOG,/seed composto invariato/);
});

test('accepted visual plans still apply; transport and oversize stay terminal',async()=>{
  const applied=await repairVisualStyleOrKeep(seed,async()=>JSON.stringify({value:'28px'}),async()=>'styled');
  assert.deepEqual(applied,{html:'styled',repairs:0,skipped:false});
  await assert.rejects(repairVisualStyleOrKeep(seed,async()=>{throw new Error('network interrupted');},async()=>'nope'),/network interrupted/);
  await assert.rejects(repairVisualStyleOrKeep(seed,async()=>'x'.repeat(16001),async()=>'nope'),/troppo grande/);
  await assert.rejects(repairVisualStyleOrKeep('<html>plain</html>',async()=>'{}',async()=>{throw new Error('Stile non consentito: font-size');}),/Stile non consentito: font-size/);
});

test('automatic polish does not skip after create seed fallback; grok-build still rewrites',()=>{
  const original = '<!doctype html><html data-fenix-model-create="1" lang="it"><head></head><body><main>Sala</main></body></html>';
  assert.equal(shouldSkipComposedPolish({html:seed,buildLog:[COMPOSED_PLAN_DEGRADED_LOG]}),false);
  assert.equal(shouldSkipComposedPolish({html:seed,buildLog:['Creazione mirata sulla composizione']}),false);
  assert.equal(shouldSkipComposedPolish({instruction:'Aggiungi tab Ordina',html:seed,buildLog:[COMPOSED_PLAN_DEGRADED_LOG]}),false);
  assert.equal(shouldSkipComposedPolish({html:'<html></html>',buildLog:[COMPOSED_PLAN_DEGRADED_LOG]}),false);
  assert.equal(shouldSkipComposedPolish({html:original,instruction:'direzione di mestiere'}),true);
  assert.equal(canKeepComposedSeedAfterPolishError('Stile non consentito: font-size. Tocca Riprendi rifinitura.',{html:seed}),true);
  assert.equal(canKeepComposedSeedAfterPolishError('Stile non consentito: font-size',{instruction:'Cambia il titolo',html:seed}),false);
  assert.equal(canKeepComposedSeedAfterPolishError('JOB_STILL_RUNNING',{html:seed}),false);
  assert.equal(canKeepComposedSeedAfterPolishError('Worker visivo fallito',{html:seed}),false);
});
