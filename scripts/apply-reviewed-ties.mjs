// Promote only the candidate explicitly reviewed by the choir owner.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertCloudflareBranch} from './cloudflare-branch.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');assertCloudflareBranch(root);
const sourcePath=path.join(root,'assets/finale-score.json'),source=await readFile(sourcePath);
const current=JSON.parse(source),bundle=JSON.parse(await readFile(path.join(root,'assets/finale-tie-review.json'),'utf8'));
const sourceHash='78ad94eabad42509bc8d02ae9b9dcb27ab373e2a1e59474c00fab28f3a6f2ad3';
const reviewHash='1f13698c4b8859b7532199d3b9f92834969a37bc4516ca908d137970b957bf85';
if(bundle.sourceHash!==sourceHash||bundle.reviewHash!==reviewHash||bundle.cases.length!==37)throw Error('This is not the approved review bundle');
const next=structuredClone(bundle.proposed);
for(const id of ['f1','f2','m1','m2'])next.voices[id].pdf=current.voices[id].pdf;
if(isDeepStrictEqual(current,next)){console.log('Approved tie corrections are already applied.');process.exit(0);}
if(createHash('sha256').update(source).digest('hex')!==sourceHash)throw Error('Production source changed since review; do not overwrite it');
const directory=path.join(root,'tmp/approved-ties');await mkdir(directory,{recursive:true});
await writeFile(path.join(directory,'before.json'),source);
await writeFile(sourcePath,JSON.stringify(next));
await writeFile(path.join(directory,'approval.json'),JSON.stringify({sourceHash,reviewHash,approvedCases:37,restVerified:{voice:'f1',fromBeat:175,toBeat:175.5},note:'All reviewed cases approved; f2-211 follows printed score.'},null,2));
console.log('Applied 37 approved cases locally. Private R2 upload and deployment are separate steps.');
