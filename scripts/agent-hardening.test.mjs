import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LocalSandbox} from '../workers/agent/sandbox/local.mjs';
import {runAgent} from '../workers/agent/agent.mjs';
import {browserCoverageProblems} from '../workers/agent/checks.mjs';

test('hung model is cancelled and releases the run', {timeout:3000},async()=>{
 const sb=await LocalSandbox.create();const ac=new AbortController();
 const pending=runAgent({sandbox:sb,model:{complete:()=>new Promise(()=>{})},brief:'fixture',signal:ac.signal});
 setTimeout(()=>ac.abort(),30);
 try{const r=await pending;assert.equal(r.outcome,'aborted');assert.equal(r.ok,false);assert.equal(sb.abort.signal.aborted,true)}finally{await sb.destroy()}
});
test('deadline stops a model that ignores AbortSignal',{timeout:3000},async()=>{
 const sb=await LocalSandbox.create();
 // Keep test process alive: AbortSignal.timeout is intentionally unref'ed by Node.
 const keep=setInterval(()=>{},50);
 try{const r=await runAgent({sandbox:sb,model:{complete:()=>new Promise(()=>{})},brief:'fixture',limits:{maxMinutes:0.001}});assert.equal(r.outcome,'timeout');assert.equal(r.ok,false)}finally{clearInterval(keep);await sb.destroy()}
});
test('local fixture file APIs reject symlink reads and writes',{timeout:3000},async()=>{
 const sb=await LocalSandbox.create();const outside=await mkdtemp(join(tmpdir(),'fenix-link-test-'));const file=join(outside,'fixture.txt');
 try{await writeFile(file,'unchanged');await symlink(file,join(sb.root,'link.txt'));await assert.rejects(sb.readFile('link.txt'),/Symlink/);await assert.rejects(sb.writeFile('link.txt','bad'),/Symlink/);assert.equal(await readFile(file,'utf8'),'unchanged')}finally{await sb.destroy();await rm(outside,{recursive:true,force:true})}
});
test('same job label creates independent directories without deleting prior files',async()=>{
 const a=await LocalSandbox.create({jobId:'same'});const b=await LocalSandbox.create({jobId:'same'});
 try{assert.notEqual(a.root,b.root);await a.writeFile('test.txt','a');await b.writeFile('test.txt','b');assert.equal(await a.readFile('test.txt'),'a')}finally{await a.destroy();await b.destroy()}
});
test('empty, duplicate and failing browser reports cannot count as coverage',()=>{
 assert.ok(browserCoverageProblems({pages:[]},['/']).length);
 const p={path:'/',viewport:'phone',status:200,interactive:{hasMain:true,textLength:30},shot:'a.png'};
 assert.ok(browserCoverageProblems({pages:[p,p]},['/']).length);
 assert.deepEqual(browserCoverageProblems({pages:[p,{...p,viewport:'desktop'}]},['/']),[]);
 assert.ok(browserCoverageProblems({pages:[p,{...p,viewport:'desktop',status:500}]},['/']).length);
});
