import { canonicalizePath, LIMITS } from '../contract.mjs';

// Runs inside the container. No generated filesystem entry is opened on the host.
export const FILE_PROGRAM = `const fs=require('node:fs'),p=require('node:path');
const q=JSON.parse(fs.readFileSync(0,'utf8'));
function safe(name){const full=p.resolve('/work',name);if(!full.startsWith('/work/'))throw Error('outside project');let cur='/work';for(const part of name.split('/')){cur=p.join(cur,part);try{if(fs.lstatSync(cur).isSymbolicLink())throw Error('symlink denied')}catch(e){if(e.code!=='ENOENT')throw e}}return full}
if(q.op==='list'){const out=[];function walk(dir,prefix=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['.fenix','.git','node_modules'].includes(e.name))continue;if(e.isSymbolicLink())throw Error('symlink denied');const name=prefix+e.name;if(e.isDirectory())walk(safe(name),name+'/');else if(e.isFile()){out.push({path:name,bytes:fs.statSync(safe(name)).size});if(out.length>120)throw Error('too many files')}}}walk('/work');console.log(JSON.stringify(out))}
else{const path=safe(q.path);if(q.op==='read'){if(fs.statSync(path).size>400000)throw Error('too large');console.log(JSON.stringify(fs.readFileSync(path,'utf8')))}else if(q.op==='write'){fs.mkdirSync(p.dirname(path),{recursive:true});fs.writeFileSync(path,q.content);console.log(JSON.stringify(Buffer.byteLength(q.content)))}else if(q.op==='delete'){fs.unlinkSync(path);console.log('true')}}`;

export class ContainerFiles {
  async readFile(path) { return this.containerNode(FILE_PROGRAM, { op:'read', path:canonicalizePath(path) }); }
  async writeFile(path, content) {
    if(typeof content!=='string'||Buffer.byteLength(content)>LIMITS.maxFileBytes)throw Error('Invalid file size');
    return this.containerNode(FILE_PROGRAM,{op:'write',path:canonicalizePath(path),content});
  }
  async deleteFile(path) { return this.containerNode(FILE_PROGRAM,{op:'delete',path:canonicalizePath(path)}); }
  async listFiles() { return this.containerNode(FILE_PROGRAM,{op:'list'}); }
  async writeRuntimeFile(name,content) {
    if(!/^[a-zA-Z0-9._-]+$/.test(name))throw Error('Invalid runtime path');
    await this.containerNode(FILE_PROGRAM,{op:'write',path:'.fenix/'+name,content});
    return '.fenix/'+name;
  }
}
