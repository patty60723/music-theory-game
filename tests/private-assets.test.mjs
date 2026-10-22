import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {encryptPrivateAssets,decryptPrivateAssets,loadPrivateAssets} from '../scripts/private-assets.mjs';
import {assertCloudflareBranch} from '../scripts/cloudflare-branch.mjs';
const key='12'.repeat(32),files={'score.json':Buffer.from(JSON.stringify({kind:'score-piano'}))};
for(const id of ['f1','f2','m1','m2'])files[id+'.pdf']=Buffer.from('%PDF-private-test-'+id);
test('encrypted assets round-trip and reject incorrect keys or modified ciphertext',()=>{
  const envelope=encryptPrivateAssets(files,key);
  assert.deepEqual(decryptPrivateAssets(envelope,key),files);
  assert.equal(JSON.stringify(envelope).includes('private-test'),false);
  assert.throws(()=>decryptPrivateAssets(envelope,'34'.repeat(32)));
  const corrupt=structuredClone(envelope),bytes=Buffer.from(corrupt.data,'base64');bytes[0]^=1;corrupt.data=bytes.toString('base64');
  assert.throws(()=>decryptPrivateAssets(corrupt,key));
  assert.throws(()=>decryptPrivateAssets(envelope,'short'));
  assert.notEqual(encryptPrivateAssets(files,key).iv,envelope.iv);
});
test('a clean checkout loads the sealed bundle with a build secret and fails without it',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'finale-assets-test-'));
  try{await mkdir(path.join(dir,'private'));await writeFile(path.join(dir,'private/finale-assets.enc.json'),JSON.stringify(encryptPrivateAssets(files,key)));
    assert.deepEqual(await loadPrivateAssets(dir,{key,encryptedOnly:true}),files);
    assert.deepEqual(await loadPrivateAssets(dir,{key}),files);
    await assert.rejects(()=>loadPrivateAssets(dir,{key:'',encryptedOnly:true}),/Set FINALE_ASSETS_KEY/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('other branches cannot build or deploy the production Worker',()=>{
  const previous=process.env.WORKERS_CI_BRANCH;
  try{process.env.WORKERS_CI_BRANCH='main';assert.throws(()=>assertCloudflareBranch(process.cwd()),/restricted to the cloudflare branch/);
    process.env.WORKERS_CI_BRANCH='cloudflare';assert.doesNotThrow(()=>assertCloudflareBranch(process.cwd()));
  }finally{if(previous===undefined)delete process.env.WORKERS_CI_BRANCH;else process.env.WORKERS_CI_BRANCH=previous;}
});
