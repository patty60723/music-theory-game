import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.mjs';
import {environment,password} from './worker-server.mjs';
const origin='https://practice.example',url=path=>origin+path;
const post=(path,body,headers={})=>new Request(url(path),{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
async function login(env){const response=await worker.fetch(post('/api/finale/login',{password}),env);assert.equal(response.status,200);const cookie=response.headers.get('Set-Cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);return cookie.split(';')[0];}
test('fail closed, same-origin login, protected resources, tampering, rotation and logout',async()=>{
  const env=environment();
  for(const path of ['/api/finale/score','/api/finale/pdf/f1','/api/finale/session'])assert.equal((await worker.fetch(new Request(url(path)),env)).status,401);
  for(const path of ['/private/finale/score.json','/assets/finale-score.json','/.dev.vars','/worker/index.mjs','/preview.html'])assert.equal((await worker.fetch(new Request(url(path)),env)).status,404);
  assert.equal((await worker.fetch(post('/api/finale/login',{password},{Origin:'https://evil.example'}),env)).status,403);
  assert.equal((await worker.fetch(post('/api/finale/login',{password:'wrong'}),env)).status,401);
  assert.equal((await worker.fetch(post('/api/finale/login',{password}),{...env,PRACTICE_PASSWORD:''})).status,503);
  const cookie=await login(env),get=path=>new Request(url(path),{headers:{Cookie:cookie}});
  const score=await worker.fetch(get('/api/finale/score'),env);assert.equal(score.status,200);assert.match(score.headers.get('Cache-Control'),/no-store/);assert.equal((await score.json()).kind,'score-piano');
  for(const id of ['f1','f2','m1','m2']){const pdf=await worker.fetch(get('/api/finale/pdf/'+id),env);assert.equal(pdf.status,200);assert.equal(pdf.headers.get('Content-Type'),'application/pdf');assert.equal(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0,4)),'%PDF');}
  const head=await worker.fetch(new Request(url('/api/finale/score'),{method:'HEAD',headers:{Cookie:cookie}}),env);assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await worker.fetch(new Request(url('/api/finale/score'),{headers:{Cookie:cookie.slice(0,-1)+(cookie.endsWith('0')?'1':'0')}}),env)).status,401);
  assert.equal((await worker.fetch(get('/api/finale/score'),{...env,PRACTICE_PASSWORD:'rotated'})).status,401);
  assert.equal((await worker.fetch(get('/api/finale/score'),{...env,SESSION_SECRET:'different-session-secret-0000000000000000'})).status,401);
  const realNow=Date.now;try{Date.now=()=>realNow()+8*3600*1000+1000;assert.equal((await worker.fetch(get('/api/finale/score'),env)).status,401);}finally{Date.now=realNow;}
  const logout=await worker.fetch(post('/api/finale/logout',{}),env);assert.match(logout.headers.get('Set-Cookie'),/Max-Age=0/);
  assert.equal((await worker.fetch(new Request(url('/')),env)).status,200);
});
test('login throttling and bounded input',async()=>{
  const env=environment();
  const large=await worker.fetch(post('/api/finale/login',{password:'x'.repeat(3000)}),env);assert.equal(large.status,413);
  for(let i=0;i<4;i++)assert.equal((await worker.fetch(post('/api/finale/login',{password:'wrong'}),env)).status,401);
  const limited=await worker.fetch(post('/api/finale/login',{password}),env);assert.equal(limited.status,429);assert.equal(limited.headers.get('Retry-After'),'60');
});
