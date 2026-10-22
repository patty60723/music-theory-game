import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareR2Assets} from './private-assets.mjs';
import {assertCloudflareBranch} from './cloudflare-branch.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
assertCloudflareBranch(root);
const config=JSON.parse(await readFile(path.join(root,'wrangler.jsonc'),'utf8'));
const bucket=config.r2_buckets.find(binding=>binding.binding==='SCORES')?.bucket_name;
if(!bucket)throw Error('Missing SCORES R2 binding');
const target=process.argv.includes('--local')?'--local':'--remote';
const entries=await prepareR2Assets(root),hash=createHash('sha256');
for(const entry of entries){
  hash.update(entry.key);hash.update(await readFile(entry.file));
  execFileSync(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'r2','object','put',bucket+'/'+entry.key,'--file',entry.file,'--content-type',entry.contentType,target],{cwd:root,stdio:'inherit',env:process.env});
}
if(target==='--remote'){
  config.vars={...config.vars,SCORE_CACHE_VERSION:hash.digest('hex').slice(0,16)};
  await writeFile(path.join(root,'wrangler.jsonc'),JSON.stringify(config,null,2)+'\n');
  console.log('Updated SCORE_CACHE_VERSION. Commit wrangler.jsonc and deploy to switch edge caches immediately.');
}
console.log('Uploaded five private objects. Program deployments do not upload or remove these objects.');
