import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {localPrivateAssets,prepareR2Assets} from '../scripts/private-assets.mjs';
import {assertCloudflareBranch} from '../scripts/cloudflare-branch.mjs';
test('R2 upload preparation keeps private data outside deployment files and rewrites PDF URLs',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'finale-assets-test-'));
  try{await mkdir(path.join(dir,'assets'));const score={kind:'score-piano',voices:{}};
    for(const id of ['f1','f2','m1','m2']){score.voices[id]={pdf:'assets/'+id+'.pdf'};await writeFile(path.join(dir,'assets',id+'.pdf'),'%PDF-private-test-'+id);}
    await writeFile(path.join(dir,'assets/finale-score.json'),JSON.stringify(score));
    const entries=await prepareR2Assets(dir);assert.equal(entries.length,5);assert.equal(entries.at(-1).key,'finale/score.json');
    const prepared=JSON.parse(await readFile(entries.at(-1).file,'utf8'));
    for(const id of ['f1','f2','m1','m2'])assert.equal(prepared.voices[id].pdf,'/api/finale/pdf/'+id);
    assert.equal((await readdir(dir)).includes('dist'),false);
    const untouched=JSON.parse(await readFile(path.join(dir,'assets/finale-score.json'),'utf8'));assert.equal(untouched.voices.f1.pdf,'assets/f1.pdf');
    score.voices.f1.pdf='../outside.pdf';await writeFile(path.join(dir,'assets/finale-score.json'),JSON.stringify(score));
    await assert.rejects(()=>localPrivateAssets(dir),/Unexpected PDF path/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('other branches cannot build or deploy the production Worker',()=>{
  const previous=process.env.WORKERS_CI_BRANCH;
  try{process.env.WORKERS_CI_BRANCH='main';assert.throws(()=>assertCloudflareBranch(process.cwd()),/restricted to the cloudflare branch/);
    process.env.WORKERS_CI_BRANCH='cloudflare';assert.doesNotThrow(()=>assertCloudflareBranch(process.cwd()));
  }finally{if(previous===undefined)delete process.env.WORKERS_CI_BRANCH;else process.env.WORKERS_CI_BRANCH=previous;}
});
