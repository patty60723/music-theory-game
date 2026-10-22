import {execFileSync} from 'node:child_process';
export function assertCloudflareBranch(root){
  const branch=process.env.WORKERS_CI_BRANCH||process.env.GITHUB_HEAD_REF||process.env.GITHUB_REF_NAME||execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim();
  if(branch!=='cloudflare')throw Error(`Cloudflare builds/deployments are restricted to the cloudflare branch; current branch: ${branch||'(detached)'}.`);
}
