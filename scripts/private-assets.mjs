import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';

const names=['score.json','f1.pdf','f2.pdf','m1.pdf','m2.pdf'];
function keyBytes(key){
  if(!/^[a-f0-9]{64}$/i.test(key||''))throw Error('FINALE_ASSETS_KEY must contain exactly 64 hexadecimal characters.');
  return Buffer.from(key,'hex');
}
export async function localPrivateAssets(root){
  const score=JSON.parse(await readFile(path.join(root,'assets/finale-score.json'),'utf8')),files={};
  for(const id of ['f1','f2','m1','m2']){
    const source=path.resolve(root,score.voices[id].pdf);
    if(!source.startsWith(path.join(root,'assets')+path.sep)||!source.endsWith('.pdf'))throw Error('Unexpected PDF path');
    files[id+'.pdf']=await readFile(source);
    score.voices[id].pdf='/api/finale/pdf/'+id;
  }
  files['score.json']=Buffer.from(JSON.stringify(score));
  return files;
}
export function encryptPrivateAssets(files,key){
  const content=Object.fromEntries(names.map(name=>[name,files[name].toString('base64')]));
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',keyBytes(key),iv);
  const ciphertext=Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(content)))),cipher.final()]);
  return {version:1,algorithm:'AES-256-GCM',iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:ciphertext.toString('base64')};
}
export function decryptPrivateAssets(envelope,key){
  if(envelope.version!==1||envelope.algorithm!=='AES-256-GCM')throw Error('Unsupported private asset bundle');
  const decipher=createDecipheriv('aes-256-gcm',keyBytes(key),Buffer.from(envelope.iv,'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
  const bytes=Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]);
  const content=JSON.parse(gunzipSync(bytes,{maxOutputLength:10*1024*1024}).toString('utf8'));
  if(Object.keys(content).length!==names.length||names.some(name=>typeof content[name]!=='string'))throw Error('Invalid private asset manifest');
  const files=Object.fromEntries(names.map(name=>[name,Buffer.from(content[name],'base64')]));
  if(JSON.parse(files['score.json']).kind!=='score-piano'||names.slice(1).some(name=>files[name].subarray(0,4).toString()!=='%PDF'))throw Error('Invalid score or PDF in private bundle');
  return files;
}
export async function loadPrivateAssets(root,{encryptedOnly=false,key=process.env.FINALE_ASSETS_KEY}={}){
  if(!encryptedOnly){try{return await localPrivateAssets(root);}catch(error){if(error.code!=='ENOENT')throw error;}}
  if(!key)throw Error('Private assets are not in Git. Set FINALE_ASSETS_KEY in Cloudflare Build secrets to decrypt private/finale-assets.enc.json.');
  return decryptPrivateAssets(JSON.parse(await readFile(path.join(root,'private/finale-assets.enc.json'),'utf8')),key);
}
