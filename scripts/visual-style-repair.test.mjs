import assert from 'node:assert/strict';
import {test} from 'node:test';
import {repairVisualStyle} from '../workers/visual/visual-style-repair.mjs';

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
