import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertCloudflareBranch} from './cloudflare-branch.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');assertCloudflareBranch(root);
const config=JSON.parse(await readFile(path.join(root,'wrangler.jsonc'),'utf8'));
const bucket=config.r2_buckets.find(binding=>binding.binding==='SCORES')?.bucket_name;
const file=path.join(root,'assets/finale-tie-review.json'),bundle=JSON.parse(await readFile(file,'utf8'));
if(!bucket||bundle.kind!=='tie-review'||!bundle.cases?.length)throw Error('Generate the private tie-review bundle before uploading');
execFileSync(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'r2','object','put',bucket+'/finale/tie-review.json','--file',file,'--content-type','application/json',process.argv.includes('--local')?'--local':'--remote'],{cwd:root,stdio:'inherit',env:process.env});
if(!process.argv.includes('--local')){config.vars={...config.vars,TIE_REVIEW_CACHE_VERSION:bundle.reviewHash.slice(0,16)};await writeFile(path.join(root,'wrangler.jsonc'),JSON.stringify(config,null,2)+'\n');}
console.log('Uploaded the private review bundle only. The production score and PDFs were not changed.');
