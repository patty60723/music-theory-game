import {mkdir,copyFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertCloudflareBranch} from './cloudflare-branch.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
assertCloudflareBranch(root);
const dist=path.join(root,'dist/public');
await mkdir(dist,{recursive:true});
// Allowlist only. Never publish the workspace, .dev.vars, drafts, MP3s or PDFs as public files.
for(const name of ['index.html','sw.js','manifest.webmanifest','finale-player.js','finale-score.js','finale-player.css'])await copyFile(path.join(root,name),path.join(dist,name));
await mkdir(path.join(dist,'icons'),{recursive:true});
for(const name of await readdir(path.join(root,'icons')))if(/^[a-zA-Z0-9-]+\.(png|svg)$/.test(name))await copyFile(path.join(root,'icons',name),path.join(dist,'icons',name));
// A stale build file must never silently become part of a deployment.
const allowed=new Set(['index.html','sw.js','manifest.webmanifest','finale-player.js','finale-score.js','finale-player.css','icons']);
for(const name of await readdir(dist))if(!allowed.has(name))throw Error('Unexpected dist entry: '+name+'; use a clean dist directory.');
console.log('Built public app only. Private scores remain in R2 and are not part of deployments.');
