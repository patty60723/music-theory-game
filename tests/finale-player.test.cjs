/* Starts a local Worker adapter. Set CATSHARK_PLAYWRIGHT if needed. */
const {chromium}=require(process.env.CATSHARK_PLAYWRIGHT||'playwright');
const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os'),fs=require('node:fs');
const score=require('../finale-score.js');
const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/finale-score.json'),'utf8'));
const timeline=score.prepare(raw);
assert.equal(timeline.secondsAt(96),48);
assert.ok(Math.abs(timeline.secondsAt(144)-(48+48*60/126))<1e-8);
assert.equal(Object.values(timeline.voices).reduce((s,v)=>s+v.notes.length,0),1074);
assert.equal(Object.values(timeline.voices).every(v=>v.performance.length<v.notes.length),true);
assert.equal(timeline.voices.f1.phrases[0].text,'Keep comin’ back;');
for(const beat of [0,.5,96,100,144,200,260])assert.ok(Math.abs(timeline.beatAt(timeline.secondsAt(beat))-beat)<1e-8);
assert.equal(timeline.voices.f1.rhythm.find(n=>n.start<=.4&&.4<n.end).kind,'rest');
const heldNote=timeline.voices.f1.rhythm.find(n=>n.start<=1.1&&1.1<n.end);assert.equal(heldNote.kind,'note');assert.equal(heldNote.endBeat-heldNote.beat,1.5);
assert.equal(timeline.voices.f1.phrases.some(p=>/^ing\b|^fore\b|^vive\b/.test(p.text)),false);
assert.throws(()=>score.prepare({...raw,tempos:[{beat:0,bpm:0}]}));
const malformed=structuredClone(raw);malformed.voices.f1.notes[0].endBeat=-1;assert.throws(()=>score.prepare(malformed));

(async()=>{
  require('node:child_process').execFileSync(process.execPath,[path.join(__dirname,'../scripts/build-worker.mjs')]);
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const adapter=await import('./worker-server.mjs'),server=await adapter.start(),base=server.url;
  async function enter(page,ready=true){
    await page.goto(base+'/#tab=finale');
    await page.waitForFunction(()=>!document.querySelector('#fnRoom').hidden||document.querySelector('#fnAuthStatus').textContent!=='正在確認登入狀態…');
    if(await page.locator('#fnAuth').isVisible()){await page.locator('#fnPassword').fill(adapter.password);await page.locator('#fnUnlock').click();}
    await page.waitForFunction(()=>!document.querySelector('#fnRoom').hidden);
    if(ready)await page.waitForFunction(()=>document.querySelector('#fnPlay')?.textContent==='播放');
  }
  try{
    const context=await browser.newContext({viewport:{width:1280,height:1000},serviceWorkers:'block'});
    const page=await context.newPage(),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
    await page.route('**/*.mp3',route=>route.abort());
    await page.addInitScript(()=>{
      window.pianoCalls=[];window.mergers=[];window.sampleRates=[];window.oscFrequencies=[];window.clickCalls=[];let factory;
      window.outputs=[];const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(destination,...args){if(destination instanceof AudioDestinationNode)outputs.push(this);return connect.call(this,destination,...args);};
      const bufferStart=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){sampleRates.push(this.playbackRate.value);return bufferStart.apply(this,args);};
      const oscStart=OscillatorNode.prototype.start;OscillatorNode.prototype.start=function(...args){oscFrequencies.push(this.frequency.value);if([1000,1500].includes(this.frequency.value)){this.testClick={frequency:this.frequency.value,time:args[0]??this.context.currentTime,stops:[]};clickCalls.push(this.testClick);}return oscStart.apply(this,args);};
      const oscStop=OscillatorNode.prototype.stop;OscillatorNode.prototype.stop=function(...args){if(this.testClick)this.testClick.stops.push(args[0]??this.context.currentTime);return oscStop.apply(this,args);};
      Object.defineProperty(window,'createFinalePlayer',{configurable:true,get(){return factory;},set(fn){factory=options=>{const play=options.pianoNote;options.pianoNote=(midi,time,duration,velocity,destination)=>{const event={midi,time,duration,velocity,stopped:false};window.pianoCalls.push(event);const handle=play(midi,time,duration,velocity,destination);return {stop(){event.stopped=true;handle?.stop();}};};return fn(options);};}});
      const create=AudioContext.prototype.createChannelMerger;
      AudioContext.prototype.createChannelMerger=function(...args){const merger=create.apply(this,args);window.mergers.push(merger);return merger;};
    });
    await enter(page);
    await page.waitForFunction(()=>document.querySelector('#fnPlay')?.textContent==='播放');
    assert.equal(await page.locator('#fnCurrentLine').textContent(),'Keep comin’ back;');
    async function assertSplit(focus,left){for(const id of ['f1','f2','m1','m2']){assert.equal(await page.locator('#fnLeft-'+id).isChecked(),id===focus?left:!left);assert.equal(await page.locator('#fnRight-'+id).isChecked(),id===focus?!left:left);}}
    await assertSplit('f1',true);
    await page.locator('#fnFocus-f2').click();await assertSplit('f2',true);
    await page.locator('#fnSwap').click();await assertSplit('f2',false);
    await page.locator('#fnFocus-m2').click();await assertSplit('m2',false);
    await page.locator('#fnSwap').click();await page.locator('#fnFocus-f1').click();await assertSplit('f1',true);
    await page.locator('#fnSeek').evaluate(el=>{el.value=.4;el.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(await page.locator('#fnRollCurrent').textContent(),'');assert.equal(await page.locator('#fnRollTrack .active').count(),0);
    await page.locator('#fnSeek').evaluate(el=>{el.value=1.1;el.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(await page.locator('#fnRollCurrent').textContent(),'F4');
    const bar=await page.locator('#fnRollTrack .active').evaluate(el=>({beat:Number(el.dataset.beat),end:Number(el.dataset.endBeat),width:el.getBoundingClientRect().width}));
    assert.equal(bar.end-bar.beat,1.5);assert.equal(bar.width,118);
    assert.equal((await page.locator('#fnRoll').textContent()).includes('休止'),false);
    assert.equal(await page.locator('#fnRollTrack .finale-roll-note').count(),timeline.voices.f1.performance.length);
    await page.locator('#fnToggleLyrics').click();assert.equal(await page.locator('#fnToggleLyrics').getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('#fnLyricsList button').count(),timeline.voices.f1.phrases.length);
    await page.locator('#fnLyricsList button').nth(2).click();assert.equal(Number(await page.locator('#fnSeek').inputValue()),timeline.voices.f1.phrases[2].start);
    assert.equal(await page.locator('#fnLyricsList button[aria-current=true]').textContent(),timeline.voices.f1.phrases[2].text);
    await page.locator('#fnFocus-f2').click();assert.equal(await page.locator('#fnLyricsList button').count(),timeline.voices.f2.phrases.length);await page.locator('#fnFocus-f1').click();
    await page.locator('#fnToggleLyrics').click();assert.equal(await page.locator('#fnAllLyrics').isVisible(),false);
    await page.locator('#fnStop').click();
    assert.equal(await page.locator('#fnOpenEditor').count(),0);
    assert.equal(requests.some(url=>/LPCFinale.*\.mp3|finale-score-drafts/.test(url)),false);
    const order=await page.evaluate(()=>['fnCurrentLine','fnKeyboard','fnConsoleHeading'].map(id=>document.getElementById(id).getBoundingClientRect().top));
    assert.ok(order[0]<order[1]&&order[1]<order[2]);
    // Real computer-key polyphony, note-off and an accessible focused key.
    await page.locator('#fnRoom h1').click();await page.keyboard.down('a');await page.keyboard.down('s');await page.keyboard.down('d');
    assert.equal(await page.locator('#fnKeyboard .key.on').count(),3);
    assert.equal(await page.locator('#fnLiveNote').textContent(),'C4 · D4 · E4');
    await page.keyboard.up('a');await page.keyboard.up('s');await page.keyboard.up('d');
    assert.equal(await page.locator('#fnKeyboard .key.on').count(),0);
    await page.evaluate(()=>{const output=outputs.at(-1);window.masterProbe=output.context.createAnalyser();masterProbe.fftSize=2048;output.connect(masterProbe);window.masterRms=()=>{const x=new Float32Array(2048);masterProbe.getFloatTimeDomainData(x);return Math.sqrt(x.reduce((s,n)=>s+n*n,0)/x.length);};});
    await page.locator('#fnRoom h1').click();await page.keyboard.down('a');await page.waitForFunction(()=>masterRms()>.0001);
    await page.locator('#fnMaster').fill('0');await page.waitForFunction(()=>masterRms()<.000001);
    await page.locator('#fnMaster').fill('100');await page.waitForFunction(()=>masterRms()>.0001);await page.keyboard.up('a');
    assert.equal(await page.evaluate(()=>pianoCalls.filter(n=>n.duration===60).every(n=>n.stopped)),true);
    const c4=page.locator('#fnKeyboard button[data-midi="60"]');await c4.focus();await c4.press('ArrowRight');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.midi),'61');
    await page.keyboard.down('Enter');assert.equal(await page.locator('#fnLiveNote').textContent(),'D♭4');await page.keyboard.up('Enter');
    const c4box=await c4.boundingBox();await page.mouse.move(c4box.x+c4box.width/2,c4box.y+c4box.height-15);await page.mouse.down();
    assert.equal(await page.locator('#fnLiveNote').textContent(),'C4');await page.mouse.up();
    assert.equal(await page.locator('#fnKeyboard .key.on').count(),0);
    // Slow enough to probe the first piano chord in the actual output graph.
    await page.locator('#fnBpm').fill('40');await page.locator('#fnBpm').press('Tab');
    for(const id of ['f2','m1','m2'])await page.locator('#fnMute-'+id).click();
    await page.locator('#fnRight-f1').uncheck();
    await page.evaluate(()=>{
      const merger=mergers[0],split=merger.context.createChannelSplitter(2);merger.connect(split);window.probes=[merger.context.createAnalyser(),merger.context.createAnalyser()];
      probes.forEach((a,i)=>{a.fftSize=2048;split.connect(a,i);});
      window.rms=()=>probes.map(a=>{const x=new Float32Array(2048);a.getFloatTimeDomainData(x);return Math.sqrt(x.reduce((s,n)=>s+n*n,0)/x.length);});
      window.pianoCalls=[];window.sampleRates=[];window.oscFrequencies=[];
    });
    await page.locator('#fnPlay').click();await page.waitForFunction(()=>document.querySelector('#fnPlay').textContent==='暫停');
    const first=await page.evaluate(()=>pianoCalls.slice(0,4));assert.equal(first.length,4);assert.equal(new Set(first.map(n=>n.time)).size,1);
    const slowPitch=await page.evaluate(()=>({samples:sampleRates.slice(0,4),osc:oscFrequencies.slice(0,16)}));
    assert.deepEqual(first.map(n=>n.midi),[65,65,73,68]);assert.ok(first.every(n=>Math.abs(n.duration-.75)<.001));
    await page.waitForFunction(()=>{const [l,r]=rms();return l>.0003&&r<.00001;});
    await page.locator('#fnMute-f1').click();await page.waitForFunction(()=>rms().every(n=>n<.00001));
    assert.equal(await page.locator('#fnCurrentLine').textContent(),'Keep comin’ back;');
    assert.equal((await page.locator('#fnLyricVoice').textContent()).includes('已靜音'),true);
    assert.equal(await page.locator('#fnLeft-f1').isChecked(),true);
    await page.locator('#fnLeft-f1').uncheck();await page.locator('#fnRight-f1').check();await page.locator('#fnVolume-f1').fill('60');
    await page.waitForFunction(()=>rms().every(n=>n<.00001));
    await page.locator('#fnMute-f1').click();await page.waitForFunction(()=>{const [l,r]=rms();return r>.0003&&l<.00001;});
    // BPM changes scheduling duration, not MIDI pitch.
    await page.locator('#fnPlay').click();await page.locator('#fnStop').click();
    await page.locator('#fnBpm').fill('120');await page.locator('#fnBpm').press('Tab');await page.evaluate(()=>{window.pianoCalls=[];window.sampleRates=[];window.oscFrequencies=[];});
    await page.locator('#fnPlay').click();await page.waitForFunction(()=>pianoCalls.length>=4);
    const normal=await page.evaluate(()=>pianoCalls.slice(0,4));assert.deepEqual(normal.map(n=>n.midi),first.map(n=>n.midi));assert.ok(Math.abs(normal[0].duration-.25)<.001);
    const normalPitch=await page.evaluate(()=>({samples:sampleRates.slice(0,4),osc:oscFrequencies.slice(0,16)}));assert.deepEqual(normalPitch,slowPitch);
    await page.locator('#fnPlay').click();
    // Score-synchronous metronome: strong first beat, BPM timing, silence and note-off.
    await page.locator('#fnStop').click();await page.locator('#fnMute-f1').click();await page.locator('#fnMetronome').check();
    await page.locator('#fnBpm').fill('200');await page.locator('#fnBpm').press('Tab');
    await page.evaluate(()=>{window.clickCalls=[];window.pianoCalls=[];});
    await page.locator('#fnPlay').click();await page.waitForFunction(()=>clickCalls.length>=3);
    const clicks=await page.evaluate(()=>clickCalls.slice(0,3));assert.deepEqual(clicks.map(c=>c.frequency),[1500,1000,1000]);
    await page.waitForFunction(()=>masterRms()>.0001);
    assert.ok(Math.abs(clicks[1].time-clicks[0].time-.3)<.005);assert.ok(Math.abs(clicks[2].time-clicks[1].time-.3)<.005);
    assert.ok(Math.abs(clicks[0].time-(await page.evaluate(()=>pianoCalls[0].time)))<.005);
    await page.locator('#fnPlay').click();assert.equal(await page.locator('#fnBeats [aria-current=true]').count(),0);
    const pausedClicks=await page.evaluate(()=>clickCalls.length);await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>clickCalls.length),pausedClicks);
    await page.locator('#fnMetroVolume').fill('25');assert.equal(await page.locator('#fnMetroVolumeOut').textContent(),'25%');
    await page.locator('#fnMetronome').uncheck();await page.locator('#fnStop').click();await page.evaluate(()=>window.clickCalls=[]);
    await page.locator('#fnPlay').click();await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>clickCalls.length),0);await page.waitForFunction(()=>masterRms()<.00001);await page.locator('#fnPlay').click();await page.locator('#fnMute-f1').click();
    await page.locator('#fnBpm').fill('120');await page.locator('#fnBpm').press('Tab');
    await page.locator('#fnSeek').evaluate(el=>{el.value=1.65;el.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(await page.locator('#fnCurrentLine [aria-current="true"]').textContent(),'in’');
    assert.ok(parseFloat(await page.locator('#fnCurrentLine [aria-current="true"]').evaluate(el=>el.style.getPropertyValue('--word-progress')))>0);
    await page.locator('#fnFocus-m1').click();assert.equal((await page.locator('#fnLyricVoice').textContent()).startsWith('男 1'),true);
    await page.locator('#fnBpmUp5').click();assert.equal(await page.locator('#fnBpm').inputValue(),'125');await page.locator('#fnBpmDown5').click();
    // Input focus must not play letter shortcuts.
    const before=await page.evaluate(()=>pianoCalls.length);await page.locator('#fnBpm').focus();await page.keyboard.press('a');assert.equal(await page.evaluate(()=>pianoCalls.length),before);
    await page.locator('#fnBpm').fill('90');await page.locator('#fnBpm').press('Tab');
    await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(os.tmpdir(),'catshark-finale-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.waitForFunction(()=>{const host=document.querySelector('#fnKeyboard').getBoundingClientRect(),key=document.querySelector('#fnKeyboard [data-midi="72"]').getBoundingClientRect();return key.left>=host.left&&key.right<=host.right;});
    await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(os.tmpdir(),'catshark-finale-mobile.png'),fullPage:true});
    await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:path.join(os.tmpdir(),'catshark-finale-dark.png'),fullPage:true});
    await page.locator('.tab[data-tab="metro"]').click();assert.equal(await page.locator('#tab-metro').isVisible(),true);
    await page.locator('.tab[data-tab="metro"]').press('ArrowRight');assert.equal(await page.locator('#tab-finale').isVisible(),true);
    // Shared instrument changes must retain the original scale/chord audio.
    await page.locator('.tab[data-tab="scale"]').click();
    let sourceCount=await page.evaluate(()=>sampleRates.length+oscFrequencies.length);await page.locator('#playBtn').click();await page.waitForFunction(count=>sampleRates.length+oscFrequencies.length>count,sourceCount);await page.locator('#playBtn').click();
    await page.locator('.tab[data-tab="chord"]').click();sourceCount=await page.evaluate(()=>sampleRates.length+oscFrequencies.length);await page.locator('#cPlay').click();await page.waitForFunction(count=>sampleRates.length+oscFrequencies.length>count,sourceCount);
    assert.deepEqual(errors,[]);
    await page.locator('.tab[data-tab="finale"]').click();await page.locator('#fnLogout').click();
    await page.waitForFunction(()=>!document.querySelector('#fnAuth').hidden);
    assert.equal(await page.locator('#fnRoom').isVisible(),false);
    assert.equal(await page.locator('#fnPdf-f1').getAttribute('href'),null);
    assert.equal((await context.request.get(base+'/api/finale/score')).status(),401);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:path.join(os.tmpdir(),'catshark-finale-login-mobile.png'),fullPage:true});
    await page.locator('#fnPassword').fill('incorrect');await page.locator('#fnUnlock').click();await page.waitForFunction(()=>document.querySelector('#fnAuthStatus').textContent==='密碼不正確。');
    await page.locator('#fnPassword').fill(adapter.password);await page.locator('#fnUnlock').click();await page.waitForFunction(()=>!document.querySelector('#fnRoom').hidden&&document.querySelector('#fnPlay').textContent==='播放');
    // Two simultaneous native touch contacts must sound independently and stop.
    const touchContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block'});
    const touchPage=await touchContext.newPage();await enter(touchPage);await touchPage.waitForFunction(()=>document.querySelector('#fnPlay')?.textContent==='播放');
    await touchPage.locator('#fnKeyboard').scrollIntoViewIfNeeded();
    const boxes=await Promise.all([64,67].map(m=>touchPage.locator(`#fnKeyboard button[data-midi="${m}"]`).boundingBox()));
    const cdp=await touchContext.newCDPSession(touchPage),points=boxes.map((b,i)=>({x:b.x+b.width/2,y:b.y+b.height-15,id:i+1}));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
    await touchPage.waitForFunction(()=>document.querySelector('#fnLiveNote').textContent==='E4 · G4');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await touchPage.locator('#fnKeyboard .key.on').count(),0);await touchContext.close();
    // A score failure is retryable. The local instrument is still usable.
    const failing=await context.newPage();await failing.route('**/api/finale/score',route=>route.abort());
    await enter(failing,false);await failing.waitForFunction(()=>document.querySelector('#fnPlay')?.textContent==='重新讀取樂譜');
    await failing.locator('#fnRoom h1').click();await failing.keyboard.down('a');assert.equal(await failing.locator('#fnLiveNote').textContent(),'C4');await failing.keyboard.up('a');
    await failing.unroute('**/api/finale/score');await failing.locator('#fnPlay').click();await failing.waitForFunction(()=>document.querySelector('#fnPlay').textContent==='播放');
    await failing.route('**/api/finale/session',route=>route.fulfill({status:401,contentType:'application/json',body:'{"authenticated":false}'}));
    await failing.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await failing.waitForFunction(()=>!document.querySelector('#fnAuth').hidden);
    assert.equal(await failing.locator('#fnCurrentLine').textContent(),'請先登入');
    // Private data never enters the offline cache. The public shell still works.
    const offlineContext=await browser.newContext(),offlinePage=await offlineContext.newPage();await enter(offlinePage);await offlinePage.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const cached=await offlinePage.evaluate(async()=>{const urls=[];for(const name of await caches.keys())for(const req of await (await caches.open(name)).keys())urls.push(req.url);return urls;});
    assert.equal(cached.some(url=>/api\/finale|assets\/|private\//.test(url)),false);
    await offlineContext.setOffline(true);await offlinePage.reload();await offlinePage.waitForFunction(()=>!document.querySelector('#fnAuth').hidden&&document.querySelector('#fnAuthRetry').hidden===false);
    assert.equal(await offlinePage.locator('#fnRoom').isVisible(),false);await offlineContext.close();
    console.log('PASS: score-based four-part synthesis without MP3 requests; stereo mute/routing; BPM scheduling without transposition; ties; playable pointer/keyboard piano; phrase karaoke; lyrics/piano/console order; narrow layout; failure/retry, server authentication and private-cache exclusion.');
  }finally{await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
