(function(){
  'use strict';
  const $=s=>document.querySelector(s),score=window.FinaleScore,audio=window.FinaleReviewAudio;
  const voices={f1:'女 1',f2:'女 2',m1:'男 1',m2:'男 2'};
  let bundle=null,original=null,proposed=null,selected=null,visibleCases=[],results={},epoch=0,checking=null;
  let context=null,output=null,playing=null,handles=[],frame=0,playToken=0;
  const verdictNames={pending:'未核對',ok:'沒問題',adjust:'需要調整'};
  const pitch=(id,midi)=>score.noteName(midi+(id.startsWith('m')?-12:0));
  const format=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  function resultFor(id){return results[id]||{status:'pending',note:''};}
  function filtered(){return bundle.cases.filter(c=>$('#rvVoice').value==='all'||c.voice===$('#rvVoice').value);}
  function caseLabel(c){return `${voices[c.voice]} · 第 ${c.measure} 小節 · ${c.lyric}`;}
  function paintList(){
    if(!bundle)return;visibleCases=filtered();$('#rvCases').replaceChildren();
    for(const c of visibleCases){const button=document.createElement('button'),small=document.createElement('span');button.type='button';button.dataset.id=c.id;button.textContent=caseLabel(c);small.textContent=(c.kind==='missing'?'補上延音':'取消誤合併')+(c.pitchChanged?' · 同時修正音高':'')+' · '+verdictNames[resultFor(c.id).status];button.appendChild(small);button.setAttribute('aria-current',String(c.id===selected?.id));$('#rvCases').appendChild(button);}
    $('#rvCount').textContent=visibleCases.length+' 段';const done=bundle.cases.filter(c=>resultFor(c.id).status!=='pending').length;
    $('#rvReviewed').textContent=`已核對 ${done} / ${bundle.cases.length} 段；結果只記在這台裝置，複製後貼給我即可。`;
  }
  function paintNotes(){
    $('#rvNotes').replaceChildren();if(!selected)return;
    for(const [label,data] of [['目前版本',original],['修正版',proposed]]){const row=document.createElement('div'),heading=document.createElement('strong');heading.textContent=label+'　';row.appendChild(heading);
      for(const n of data.voices[selected.voice].performance.filter(n=>n.beat<selected.endBeat&&n.endBeat>selected.startBeat)){const span=document.createElement('span');span.textContent=pitch(selected.voice,n.midi)+`（${Number((n.endBeat-n.beat).toFixed(3))} 拍） `;span.dataset.start=n.start;span.dataset.end=n.end;row.appendChild(span);}$('#rvNotes').appendChild(row);
    }
  }
  function selectCase(id){
    stop();selected=bundle.cases.find(c=>c.id===id)||filtered()[0];if(!selected)return;
    $('#rvCaseHeading').textContent=caseLabel(selected);$('#rvReason').textContent=selected.kind==='missing'?'原譜有延音線：修正版會連成長音，請聽是否還有不應出現的重敲。':'原譜這兩個音沒有延音線：修正版會分開彈奏，請確認重新起音的位置。';
    const old=original.voices[selected.voice].notes[selected.noteIndex],next=proposed.voices[selected.voice].notes[selected.noteIndex];
    $('#rvPitch').textContent=selected.pitchChanged?`本段也修正跨小節的延音音高：${pitch(selected.voice,old.midi)} → ${pitch(selected.voice,next.midi)}。`:'本段以所選聲部單獨播放，包含前後各一拍，方便聽出差別。';
    $('#rvImage').src=selected.image;$('#rvImage').alt=caseLabel(selected)+'的原譜截圖';$('#rvPdf').href='/api/finale/pdf/'+selected.voice;
    const result=resultFor(selected.id);for(const radio of document.querySelectorAll('[name=rvVerdict]'))radio.checked=radio.value===result.status;$('#rvComment').value=result.note;
    paintNotes();paintList();const i=visibleCases.findIndex(c=>c.id===selected.id);$('#rvPrevious').disabled=i<=0;$('#rvNext').disabled=i>=visibleCases.length-1;
    $('#rvClock').textContent=`${format(original.secondsAt(selected.startBeat))} – ${format(original.secondsAt(selected.endBeat))}`;
    $('#rvPlaying').textContent='已選段落，可比較目前版本與修正版';$('#rvProgress').value=0;
  }
  function stop(){
    playToken++;while(handles.length)handles.pop()?.stop();playing=null;cancelAnimationFrame(frame);audio.setActive(false);
    for(const id of ['rvOriginal','rvProposed'])$('#'+id).setAttribute('aria-pressed','false');
    if(bundle)$('#rvPlaying').textContent='已停止，可重新比較同一段';
    document.querySelectorAll('#rvNotes [aria-current]').forEach(el=>el.removeAttribute('aria-current'));
  }
  function ensureAudio(){
    context=audio.ac();if(output)return;
    output=context.createGain();const compressor=context.createDynamicsCompressor();compressor.threshold.value=-8;compressor.knee.value=12;compressor.ratio.value=4;compressor.attack.value=.003;compressor.release.value=.15;
    const makeup=context.createGain();makeup.gain.value=3;const limiter=context.createDynamicsCompressor();limiter.threshold.value=-2;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.001;limiter.release.value=.08;output.connect(compressor);compressor.connect(makeup);makeup.connect(limiter);limiter.connect(context.destination);
  }
  async function play(mode){
    if(!bundle||!selected)return;stop();const attempt=playToken;
    try{ensureAudio();await context.resume();if(attempt!==playToken||!bundle)return;
      const data=mode==='original'?original:proposed,whole=$('#rvWhole').checked,from=whole?0:data.secondsAt(selected.startBeat),to=whole?data.duration:data.secondsAt(selected.endBeat),rate=Number($('#rvBpm').value)/120;
      if(!Number.isFinite(rate)||rate<40/120||rate>200/120)throw Error('速度請設定為 40–200 BPM。');
      const ids=whole?($('#rvVoice').value==='all'?Object.keys(voices):[$('#rvVoice').value]):[selected.voice],origin=context.currentTime+.06;
      for(const id of ids)for(const note of data.voices[id].performance){const start=Math.max(from,note.start),end=Math.min(to,note.end);if(end<=start)continue;handles.push(audio.pianoNote(note.midi+(id.startsWith('m')?-12:0),origin+(start-from)/rate,(end-start)/rate,.4,output));}
      playing={mode,from,to,rate,origin};audio.setActive(true);$('#rvPlaying').textContent=(mode==='original'?'目前版本':'修正版')+' · '+(whole?(ids.length===4?'四聲部整首':voices[ids[0]]+'整首'):voices[selected.voice]+'單聲部段落');
      $('#'+(mode==='original'?'rvOriginal':'rvProposed')).setAttribute('aria-pressed','true');frame=requestAnimationFrame(tick);
    }catch(error){stop();$('#rvPlaying').textContent=error.message||'無法播放，請再試一次。';}
  }
  function tick(){
    if(!playing)return;const p=playing,time=Math.min(p.to,p.from+Math.max(0,context.currentTime-p.origin)*p.rate);$('#rvClock').textContent=format(time)+' / '+format(p.to);$('#rvProgress').max=p.to-p.from;$('#rvProgress').value=time-p.from;
    for(const span of document.querySelectorAll('#rvNotes span')){if(Number(span.dataset.start)<=time&&time<Number(span.dataset.end))span.setAttribute('aria-current','true');else span.removeAttribute('aria-current');}
    if(time>=p.to){stop();$('#rvPlaying').textContent='播放結束，可切換另一版本比較';return;}frame=requestAnimationFrame(tick);
  }
  function save(){
    $('#rvCopyStatus').textContent='';
    if(!bundle||!selected)return;results[selected.id]={status:$('[name=rvVerdict]:checked').value,note:$('#rvComment').value.slice(0,1000)};
    try{localStorage.setItem('finale-tie-review:'+bundle.reviewHash,JSON.stringify(results));$('#rvStorage').textContent='';}catch{$('#rvStorage').textContent='這台裝置無法儲存，請在離開前複製核對結果。';}paintList();
  }
  $('#rvCases').onclick=event=>{const button=event.target.closest('button[data-id]');if(button)selectCase(button.dataset.id);};
  $('#rvVoice').onchange=()=>selectCase(filtered()[0]?.id);$('#rvWhole').onchange=stop;
  $('#rvOriginal').onclick=()=>play('original');$('#rvProposed').onclick=()=>play('proposed');$('#rvStop').onclick=stop;
  $('#rvBpm').onchange=()=>{stop();if(!Number.isFinite(Number($('#rvBpm').value))||Number($('#rvBpm').value)<40||Number($('#rvBpm').value)>200){$('#rvBpm').value=120;$('#rvPlaying').textContent='速度請設定為 40–200 BPM，已回到原速。';}};
  $('#rvTempoReset').onclick=()=>{$('#rvBpm').value=120;stop();};
  for(const input of document.querySelectorAll('[name=rvVerdict]'))input.onchange=save;$('#rvComment').oninput=save;
  for(const [id,direction] of [['rvPrevious',-1],['rvNext',1]])$('#'+id).onclick=()=>{const index=visibleCases.findIndex(c=>c.id===selected.id);if(visibleCases[index+direction])selectCase(visibleCases[index+direction].id);};
  $('#rvZoom').onclick=()=>{if(!selected)return;$('#rvZoomImage').src=selected.image;$('#rvDialog').showModal();};$('#rvCloseZoom').onclick=()=>$('#rvDialog').close();
  $('#rvCopy').onclick=async()=>{
    if(!bundle)return;const report={kind:'finale-tie-review-feedback',version:1,sourceHash:bundle.sourceHash,reviewHash:bundle.reviewHash,results:bundle.cases.map(c=>({id:c.id,voice:c.voice,beat:c.beat,...resultFor(c.id)}))},text=JSON.stringify(report,null,2);
    try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);else throw Error();$('#rvCopyStatus').textContent='已複製，直接貼回對話即可。';}
    catch{const field=document.createElement('textarea');field.value=text;field.setAttribute('aria-label','可複製的核對結果');$('#rvCopyStatus').replaceChildren(field);field.focus();field.select();if(document.execCommand('copy')){$('#rvCopyStatus').textContent='已複製，直接貼回對話即可。';}else field.readOnly=true;}
  };
  function lock(message){
    epoch++;stop();bundle=null;original=null;proposed=null;selected=null;visibleCases=[];results={};$('#rvRoom').hidden=true;$('#rvAuth').hidden=false;$('#rvLogout').hidden=true;
    $('#rvCases').replaceChildren();$('#rvNotes').replaceChildren();for(const id of ['rvImage','rvZoomImage'])$('#'+id).removeAttribute('src');$('#rvPdf').removeAttribute('href');$('#rvComment').value='';if($('#rvDialog').open)$('#rvDialog').close();
    for(const id of ['rvCaseHeading','rvReason','rvPitch','rvSummary','rvReviewed','rvCopyStatus','rvStorage','rvCount','rvClock'])$('#'+id).textContent='';$('#rvAuthStatus').textContent=message;
  }
  async function checkSession(){
    if(checking)return checking;const attempt=epoch;
    const task=(async()=>{try{
      const session=await fetch('/api/finale/session',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});if(attempt!==epoch)return;
      if(session.status===401){lock('請輸入練唱密碼。');$('#rvRetry').hidden=true;return;}if(!session.ok)throw Error();
      if(bundle)return;$('#rvAuthStatus').textContent='正在載入核對段落…';
      const response=await fetch('/api/finale/tie-review',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});if(attempt!==epoch)return;if(response.status===401){lock('登入已到期，請重新輸入密碼。');return;}if(!response.ok)throw Error();
      const data=await response.json();if(attempt!==epoch)return;
      if(data.kind!=='tie-review'||data.version!==1||!Array.isArray(data.cases)||!data.cases.length||data.cases.length>1000||!/^\w{64}$/.test(data.reviewHash))throw Error();
      const before=score.prepare(data.original),after=score.prepare(data.proposed);
      for(const c of data.cases)if(!voices[c.voice]||!before.voices[c.voice].notes[c.noteIndex]||!c.image?.startsWith('data:image/png;base64,')||!Number.isFinite(c.startBeat)||!Number.isFinite(c.endBeat)||c.endBeat<=c.startBeat)throw Error();
      bundle=data;original=before;proposed=after;results={};
      try{const saved=JSON.parse(localStorage.getItem('finale-tie-review:'+bundle.reviewHash)||'{}');for(const c of bundle.cases){const value=saved[c.id];if(value&&Object.hasOwn(verdictNames,value.status))results[c.id]={status:value.status,note:String(value.note||'').slice(0,1000)};}}catch{}
      $('#rvAuth').hidden=true;$('#rvRoom').hidden=false;$('#rvLogout').hidden=false;$('#rvRetry').hidden=true;$('#rvSummary').textContent=`${data.summary.missing} 處漏判、${data.summary.incorrect} 處誤合併，其中 ${data.summary.pitch} 處也調整音高。`;selectCase(filtered()[0]?.id);
    }catch{if(attempt===epoch){lock('核對資料暫時無法載入，請確認網路後重試。');$('#rvRetry').hidden=false;}}})();checking=task;
    try{await task;}finally{if(checking===task)checking=null;}
  }
  $('#rvLogin').onsubmit=async event=>{event.preventDefault();const button=$('#rvUnlock');if(button.disabled)return;if(!$('#rvPassword').value){$('#rvAuthStatus').textContent='請輸入練唱密碼。';$('#rvPassword').focus();return;}button.disabled=true;
    try{if(checking)await checking;const attempt=epoch,password=$('#rvPassword').value;$('#rvPassword').value='';const response=await fetch('/api/finale/login',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({password}),signal:AbortSignal.timeout(10000)});if(attempt!==epoch)return;const result=await response.json();if(!response.ok){$('#rvAuthStatus').textContent=result.error||'無法登入。';return;}await checkSession();}catch{$('#rvAuthStatus').textContent='無法連線，請稍後再試。';}finally{button.disabled=false;}};
  $('#rvLogout').onclick=async()=>{stop();$('#rvLogout').disabled=true;try{const response=await fetch('/api/finale/logout',{method:'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();lock('已登出。');}catch{$('#rvPlaying').textContent='登出未完成，請確認網路後重試。';}finally{$('#rvLogout').disabled=false;}};
  $('#rvRetry').onclick=checkSession;setInterval(()=>{if(playing&&context.currentTime>=playing.origin+(playing.to-playing.from)/playing.rate){stop();$('#rvPlaying').textContent='播放結束，可切換另一版本比較';}},1000);
  let authCheck=Date.now();setInterval(()=>{if(bundle&&Date.now()-authCheck>=60000){authCheck=Date.now();checkSession();}},10000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(bundle)checkSession();if(playing){cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);}}});window.addEventListener('pagehide',stop);checkSession();
})();
