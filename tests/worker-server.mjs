// Test-only adapter: exercises the same Worker with real HTTP and local asset bindings.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import worker from '../worker/index.mjs';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const password='local-test-password-only';
export function environment(){
  const attempts=new Map();
  return {
    PRACTICE_PASSWORD:password,SESSION_SECRET:'test-only-session-key-00000000000000000000',
    LOGIN_LIMITER:{async limit({key}){const minute=Math.floor(Date.now()/60000),id=key+minute,count=(attempts.get(id)||0)+1;attempts.set(id,count);return {success:count<=5};}},
    ASSETS:{async fetch(request){
      const relative=decodeURIComponent(new URL(request.url).pathname).slice(1)||'index.html',file=path.resolve(root,'dist',relative);
      if(!file.startsWith(path.join(root,'dist')+path.sep))return new Response(null,{status:404});
      try{const bytes=await readFile(file),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.pdf':'application/pdf'};
        return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':types[path.extname(file)]||'application/octet-stream'}});
      }catch{return new Response(null,{status:404});}
    }}
  };
}
export async function start(port=0){
  const env=environment();
  const server=http.createServer(async(req,res)=>{
    try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks),headers=new Headers();for(const [name,value] of Object.entries(req.headers))if(value)headers.set(name,Array.isArray(value)?value.join(','):value);
      const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers,...(body.length?{body}:{} )});
      const response=await worker.fetch(request,env);res.statusCode=response.status;response.headers.forEach((value,name)=>{if(name!=='set-cookie')res.setHeader(name,value);});
      const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);res.end(Buffer.from(await response.arrayBuffer()));
    }catch(error){console.error(error);res.statusCode=500;res.end('Test adapter error');}
  });
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  return {url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>server.close(resolve))};
}
