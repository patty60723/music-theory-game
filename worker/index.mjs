const COOKIE='__Host-finale_session',TTL=8*60*60;
const encoder=new TextEncoder();
const publicFiles=new Set(['/', '/index.html', '/sw.js', '/manifest.webmanifest', '/finale-player.css', '/finale-player.js', '/finale-score.js']);
const pdfIds=new Set(['f1','f2','m1','m2']);
const privateHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{...privateHeaders,...headers}});
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const unhex=s=>Uint8Array.from(s.match(/../g)||[],b=>parseInt(b,16));
const digest=s=>crypto.subtle.digest('SHA-256',encoder.encode(s));
async function key(env){
  // Including a password fingerprint invalidates existing sessions on password rotation.
  const material=env.SESSION_SECRET+'\0'+hex(await digest(env.PRACTICE_PASSWORD));
  return crypto.subtle.importKey('raw',encoder.encode(material),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
async function session(request,env){
  const value=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!value||value.length>250)return false;
  const match=/^(\d{10})\.([0-9a-f]{32})\.([0-9a-f]{64})$/.exec(value);if(!match)return false;
  const issued=Number(match[1]),now=Math.floor(Date.now()/1000);if(issued>now+30||now-issued>=TTL)return false;
  return crypto.subtle.verify('HMAC',await key(env),unhex(match[3]),encoder.encode(match[1]+'.'+match[2]));
}
async function equalPassword(input,expected){
  const a=new Uint8Array(await digest(input)),b=new Uint8Array(await digest(expected));let mismatch=0;
  for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];return mismatch===0;
}
const cookie=(value,age)=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
async function api(request,env,url){
  if(!env.PRACTICE_PASSWORD||!env.SESSION_SECRET||env.SESSION_SECRET.length<32)return json({error:'練唱服務尚未完成設定。'},503);
  const path=url.pathname;
  if(path==='/api/finale/login'||path==='/api/finale/logout'){
    if(request.method!=='POST')return json({error:'Method not allowed'},405,{Allow:'POST'});
    if(request.headers.get('Origin')!==url.origin)return json({error:'不允許此來源。'},403);
    if(path.endsWith('/logout'))return json({ok:true},200,{'Set-Cookie':cookie('',0)});
    if(!env.LOGIN_LIMITER)return json({error:'練唱服務尚未完成設定。'},503);
    const limit=await env.LOGIN_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'});
    if(!limit.success)return json({error:'嘗試次數過多，請稍候一分鐘再試。'},429,{'Retry-After':'60'});
    if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))return json({error:'需要 JSON 格式。'},415);
    // Stream limit also handles requests without a Content-Length header.
    const reader=request.body?.getReader();let bytes=0,chunks=[];
    if(!reader)return json({error:'請輸入密碼。'},400);
    while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>2048){await reader.cancel();return json({error:'輸入過長。'},413);}chunks.push(value);}
    const body=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
    let input;try{input=JSON.parse(new TextDecoder().decode(body));}catch{return json({error:'輸入格式不正確。'},400);}
    if(typeof input?.password!=='string'||!await equalPassword(input.password,env.PRACTICE_PASSWORD))return json({error:'密碼不正確。'},401);
    const payload=Math.floor(Date.now()/1000)+'.'+hex(crypto.getRandomValues(new Uint8Array(16)));
    const signature=hex(await crypto.subtle.sign('HMAC',await key(env),encoder.encode(payload)));
    return json({ok:true},200,{'Set-Cookie':cookie(payload+'.'+signature,TTL)});
  }
  if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405,{Allow:'GET, HEAD'});
  const authenticated=await session(request,env);
  if(path==='/api/finale/session')return json({authenticated},authenticated?200:401);
  if(!authenticated)return json({error:'請先輸入練唱密碼。'},401);
  let file,type;
  if(path==='/api/finale/score'){file='/private/finale/score.json';type='application/json; charset=utf-8';}
  else {const id=path.match(/^\/api\/finale\/pdf\/(f1|f2|m1|m2)$/)?.[1];if(!pdfIds.has(id))return json({error:'Not found'},404);file='/private/finale/'+id+'.pdf';type='application/pdf';}
  const resource=new URL(file,url.origin),response=await env.ASSETS.fetch(new Request(resource,{method:request.method}));
  if(!response.ok)return json({error:'樂譜暫時無法讀取。'},503);
  return new Response(request.method==='HEAD'?null:response.body,{headers:{...privateHeaders,'Content-Type':type,...(type==='application/pdf'?{'Content-Disposition':'inline; filename="'+file.split('/').pop()+'"'}:{})}});
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/finale/'))return api(request,env,url);
    // Never expose the asset binding's private paths, source scores, or repo files.
    if(!publicFiles.has(url.pathname)&&!/^\/icons\/[a-zA-Z0-9-]+\.(png|svg)$/.test(url.pathname))return new Response('Not found',{status:404});
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
    const response=await env.ASSETS.fetch(request),headers=new Headers(response.headers);
    headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');
    if(url.pathname==='/sw.js')headers.set('Cache-Control','no-cache');
    return new Response(response.body,{status:response.status,headers});
  }
};
