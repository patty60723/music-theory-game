import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {localPrivateAssets,encryptPrivateAssets} from './private-assets.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),keyFile=path.join(root,'.private-assets.key');
let key=process.env.FINALE_ASSETS_KEY;
if(!key){
  try{key=(await readFile(keyFile,'utf8')).trim();}
  catch(error){if(error.code!=='ENOENT')throw error;key=randomBytes(32).toString('hex');await writeFile(keyFile,key+'\n',{flag:'wx',mode:0o600});}
}
const envelope=encryptPrivateAssets(await localPrivateAssets(root),key);
await mkdir(path.join(root,'private'),{recursive:true});
await writeFile(path.join(root,'private/finale-assets.enc.json'),JSON.stringify(envelope)+'\n');
console.log('Sealed the score and four PDFs. Commit private/finale-assets.enc.json.');
console.log('The build key stays in ignored .private-assets.key (or your existing FINALE_ASSETS_KEY environment variable); it was not printed.');
