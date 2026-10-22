import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareR2Assets} from './private-assets.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const entry of await prepareR2Assets(root))console.log(entry.key+' ← '+entry.file);
