import {mkdir,copyFile,readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertCloudflareBranch} from './cloudflare-branch.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
assertCloudflareBranch(root);
const dist=path.join(root,'dist/public');
await mkdir(dist,{recursive:true});
// Allowlist only. Never publish the workspace, .dev.vars, drafts, MP3s or PDFs as public files.
const publicFiles=['index.html','sw.js','manifest.webmanifest','finale-player.js','finale-score.js','finale-player.css','finale-review.html','finale-review.js','finale-review.css'];
for(const name of publicFiles)await copyFile(path.join(root,name),path.join(dist,name));
// The review page uses the canonical instrument and theme, not a second audio implementation.
const index=await readFile(path.join(root,'index.html'),'utf8');
const samples=index.match(/<script>(window\.PIANO_SAMPLES=[\s\S]*?)<\/script>/)?.[1];
const audioStart=index.indexOf('let ctx=null, master=null;'),audioEnd=index.indexOf('/* ================= THEORY ================= */',audioStart);
const theme=index.match(/<style>([\s\S]*?)<\/style>/)?.[1];
if(!samples||audioStart<0||audioEnd<=audioStart||!theme)throw Error('Shared review instrument/theme extraction failed');
await writeFile(path.join(dist,'finale-review-theme.css'),theme);
await writeFile(path.join(dist,'finale-review-audio.js'),samples+'\n(function(){\n'+index.slice(audioStart,audioEnd)+"\nwindow.FinaleReviewAudio={ac,pianoNote,setActive(active){finaleAudioActive=active;if(!active&&document.hidden&&silentEl){silentEl.pause();unmuted=false;}}};\n})();\n");
await mkdir(path.join(dist,'icons'),{recursive:true});
for(const name of await readdir(path.join(root,'icons')))if(/^[a-zA-Z0-9-]+\.(png|svg)$/.test(name))await copyFile(path.join(root,'icons',name),path.join(dist,'icons',name));
// A stale build file must never silently become part of a deployment.
const allowed=new Set([...publicFiles,'finale-review-theme.css','finale-review-audio.js','icons']);
for(const name of await readdir(dist))if(!allowed.has(name))throw Error('Unexpected dist entry: '+name+'; use a clean dist directory.');
console.log('Built public app only. Private scores remain in R2 and are not part of deployments.');
