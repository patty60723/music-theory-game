const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {chromium}=require(process.env.CATSHARK_PLAYWRIGHT||'playwright'),score=require('../finale-score.js');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'assets/finale-score.json'));
const bundle=JSON.parse(fs.readFileSync(path.join(root,'assets/finale-tie-review.json'),'utf8'));
const original=score.prepare(bundle.original),proposed=score.prepare(bundle.proposed);
assert.equal(bundle.sourceHash,crypto.createHash('sha256').update(source).digest('hex'));
assert.deepEqual(bundle.summary,{verifiedTies:205,missing:34,incorrect:3,pitch:4,lyricChains:30});assert.equal(bundle.cases.length,37);
assert.equal(Object.values(bundle.proposed.voices).reduce((sum,v)=>sum+v.notes.filter(n=>n.tieFromPrevious).length,0),205);
assert.equal(bundle.proposed.voices.f1.notes.find(n=>n.beat===243.5).tieFromPrevious,false);
assert.equal(bundle.proposed.voices.f1.notes.find(n=>n.beat===244).tieFromPrevious,true);
for(const [beat,midi] of [[196,71],[200,71],[212,72],[216,72]])assert.equal(bundle.proposed.voices.m2.notes.find(n=>n.beat===beat).midi,midi);
for(const id of Object.keys(original.voices)){assert.equal(original.voices[id].notes.length,proposed.voices[id].notes.length);assert.deepEqual(original.voices[id].notes.map(n=>[n.beat,n.endBeat]),proposed.voices[id].notes.map(n=>[n.beat,n.endBeat]));}
(async()=>{
  require('node:child_process').execFileSync(process.execPath,[path.join(root,'scripts/build-worker.mjs')]);
  const adapter=await import('./worker-server.mjs'),server=await adapter.start(),browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:1000},permissions:['clipboard-read','clipboard-write'],serviceWorkers:'block'}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.reviewCalls=[];window.reviewOutputs=[];let engine;
      Object.defineProperty(window,'FinaleReviewAudio',{get:()=>engine,set(value){const note=value.pianoNote;value.pianoNote=(midi,time,duration,...rest)=>{const event={midi,time,duration,stopped:false};reviewCalls.push(event);const handle=note(midi,time,duration,...rest);return {stop(){event.stopped=true;handle.stop();}};};engine=value;}});
      const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(destination,...args){if(destination instanceof AudioDestinationNode)reviewOutputs.push(this);return connect.call(this,destination,...args);};
    });
    assert.equal((await context.request.get(server.url+'/api/finale/tie-review')).status(),401);
    await page.goto(server.url+'/finale-review.html');await page.waitForFunction(()=>document.querySelector('#rvAuthStatus').textContent!=='正在確認登入…');
    assert.equal(await page.locator('#rvRoom').isVisible(),false);
    await page.locator('#rvPassword').fill('wrong');await page.locator('#rvUnlock').click();await page.waitForFunction(()=>document.querySelector('#rvAuthStatus').textContent==='密碼不正確。');
    await page.locator('#rvPassword').fill(adapter.password);await page.locator('#rvUnlock').click();await page.waitForFunction(()=>document.querySelectorAll('#rvCases button').length===37);
    assert.equal(await page.locator('#rvImage').getAttribute('src').then(s=>s.startsWith('data:image/png;base64,')),true);
    async function playAndCapture(mode){await page.evaluate(()=>window.reviewCalls=[]);await page.locator(mode==='original'?'#rvOriginal':'#rvProposed').click();await page.waitForFunction(()=>reviewCalls.length>0);return page.evaluate(()=>reviewCalls.map(({midi,time,duration})=>({midi,time,duration})));}
    function expected(mode,c,rate=1){const data=mode==='original'?original:proposed,from=data.secondsAt(c.startBeat),to=data.secondsAt(c.endBeat);return data.voices[c.voice].performance.filter(n=>n.end>from&&n.start<to).map(n=>({midi:n.midi+(c.voice.startsWith('m')?-12:0),duration:(Math.min(n.end,to)-Math.max(n.start,from))/rate}));}
    let selected=bundle.cases[0],before=await playAndCapture('original');assert.deepEqual(before.map(({midi,duration})=>({midi,duration})),expected('original',selected));
    await page.evaluate(()=>{const output=reviewOutputs.at(-1);window.probe=output.context.createAnalyser();probe.fftSize=2048;output.connect(probe);window.reviewRms=()=>{const x=new Float32Array(2048);probe.getFloatTimeDomainData(x);return Math.sqrt(x.reduce((sum,n)=>sum+n*n,0)/x.length);};});await page.waitForFunction(()=>reviewRms()>.0001);
    await page.locator('#rvStop').click();assert.equal(await page.evaluate(()=>reviewCalls.every(n=>n.stopped)),true);
    let after=await playAndCapture('proposed');assert.deepEqual(after.map(({midi,duration})=>({midi,duration})),expected('proposed',selected));assert.equal(before.length-after.length,1);await page.locator('#rvStop').click();
    await page.locator('#rvBpm').fill('60');await page.locator('#rvBpm').press('Tab');const slow=await playAndCapture('proposed');assert.deepEqual(slow.map(n=>n.midi),after.map(n=>n.midi));slow.forEach((n,i)=>assert.ok(Math.abs(n.duration-after[i].duration*2)<.00001));await page.locator('#rvTempoReset').click();
    await page.locator('#rvVoice').selectOption('m2');assert.equal(await page.locator('#rvCases button').count(),11);selected=bundle.cases.find(c=>c.voice==='m2'&&c.pitchChanged);
    await page.locator(`#rvCases button[data-id="${selected.id}"]`).click();after=await playAndCapture('proposed');assert.deepEqual(after.map(({midi,duration})=>({midi,duration})),expected('proposed',selected));assert.match(await page.locator('#rvPitch').textContent(),/→/);await page.locator('#rvStop').click();
    await page.locator('#rvWhole').check();after=await playAndCapture('proposed');assert.equal(after.length,proposed.voices.m2.performance.length);await page.locator('#rvStop').click();
    await page.locator('#rvVoice').selectOption('all');after=await playAndCapture('proposed');assert.equal(after.length,Object.values(proposed.voices).reduce((sum,v)=>sum+v.performance.length,0));await page.locator('#rvStop').click();await page.locator('#rvWhole').uncheck();
    await page.locator('[name=rvVerdict][value=ok]').check();await page.locator('#rvComment').fill('這段確認連續延長。');await page.locator('#rvCopy').click();
    const feedback=JSON.parse(await page.evaluate(()=>navigator.clipboard.readText()));assert.equal(feedback.results[0].status,'ok');assert.equal(feedback.results[0].note,'這段確認連續延長。');assert.equal(feedback.reviewHash,bundle.reviewHash);assert.equal(feedback.original,undefined);
    await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#rvCases button').length===37);assert.equal(await page.locator('[name=rvVerdict][value=ok]').isChecked(),true);assert.equal(await page.locator('#rvComment').inputValue(),'這段確認連續延長。');
    await page.screenshot({path:path.join(os.tmpdir(),'catshark-tie-review-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('#rvZoom').click();assert.equal(await page.locator('#rvDialog').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#rvDialog').isVisible(),false);
    await page.screenshot({path:path.join(os.tmpdir(),'catshark-tie-review-mobile.png'),fullPage:true});
    await page.locator('#rvLogout').click();await page.waitForFunction(()=>!document.querySelector('#rvAuth').hidden);assert.equal(await page.locator('#rvCases button').count(),0);assert.equal(await page.locator('#rvImage').getAttribute('src'),null);assert.equal((await context.request.get(server.url+'/api/finale/tie-review')).status(),401);
    await page.route('**/api/finale/tie-review',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
    await page.locator('#rvPassword').fill(adapter.password);await page.locator('#rvUnlock').click();await page.waitForFunction(()=>!document.querySelector('#rvRetry').hidden);assert.equal(await page.locator('#rvRoom').isVisible(),false);
    await page.unroute('**/api/finale/tie-review');await page.locator('#rvRetry').click();await page.waitForFunction(()=>!document.querySelector('#rvRoom').hidden);
    await page.route('**/api/finale/session',route=>route.fulfill({status:401,contentType:'application/json',body:'{"authenticated":false}'}));await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForFunction(()=>!document.querySelector('#rvAuth').hidden);assert.equal(await page.locator('#rvCases button').count(),0);
    assert.deepEqual(errors,[]);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'assets/finale-score.json'))).digest('hex'),bundle.sourceHash);
    console.log('PASS: private review authentication, PDF crops, actual A/B audio and pitch/duration changes, full-song/voice modes, BPM, verdict persistence, clipboard export, mobile layout and expiry cleanup; production score unchanged.');
  }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
