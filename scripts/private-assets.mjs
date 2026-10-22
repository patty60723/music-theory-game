import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
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
export async function prepareR2Assets(root){
  const files=await localPrivateAssets(root),directory=path.join(root,'tmp/r2-upload/finale'),entries=[];
  await mkdir(directory,{recursive:true});
  // Upload the JSON last so the first upload never advertises PDFs that are absent.
  for(const name of ['f1.pdf','f2.pdf','m1.pdf','m2.pdf','score.json']){
    const file=path.join(directory,name);await writeFile(file,files[name]);
    entries.push({key:'finale/'+name,file,contentType:name.endsWith('.pdf')?'application/pdf':'application/json'});
  }
  return entries;
}
