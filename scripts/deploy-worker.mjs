import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertCloudflareBranch} from './cloudflare-branch.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
assertCloudflareBranch(root);
execFileSync(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'deploy',...process.argv.slice(2)],{cwd:root,stdio:'inherit',env:process.env});
