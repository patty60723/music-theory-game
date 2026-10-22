(function(){
  'use strict';
  window.createFinalePlayer=function({ac,makePiano,pianoNote}){
    const $=s=>document.querySelector(s),score=window.FinaleScore;
    const voices=[{id:'f1',name:'女 1',color:'--c-root'},{id:'f2',name:'女 2',color:'--c-third'},{id:'m1',name:'男 1',color:'--c-fifth'},{id:'m2',name:'男 2',color:'--c-seventh'}];
    const section=$('#tab-finale');
    section.innerHTML=`
      <section class="panel finale-auth" id="fnAuth" aria-labelledby="fnAuthHeading"><h1 id="fnAuthHeading">四聲部練唱室</h1><p>輸入練唱密碼，即可使用樂譜、動態歌詞與鋼琴練唱。</p><form id="fnLogin"><label for="fnPassword">練唱密碼</label><div class="finale-auth-actions"><input id="fnPassword" type="password" autocomplete="current-password" required maxlength="256"><button class="play" id="fnUnlock" type="submit">進入練唱室</button></div></form><p id="fnAuthStatus" role="status">正在確認登入狀態…</p><button class="ghost" id="fnAuthRetry" hidden>重新連線</button></section>
      <div id="fnRoom" class="finale-room" hidden>
      <div class="finale-title"><div><h1>四聲部鋼琴練唱</h1><p>I Love You, You’re Perfect, Now Change · Finale</p></div><button class="ghost" id="fnLogout">登出練唱室</button></div>
      <section class="panel finale-karaoke" aria-labelledby="fnLyricsHeading">
        <div class="finale-key-caption"><h2 id="fnLyricsHeading">動態歌詞</h2><span id="fnLyricVoice">女 1 · 練唱歌詞</span></div>
        <p class="finale-previous" id="fnPreviousLine" aria-label="上一句"></p>
        <div class="finale-current-line" id="fnCurrentLine" role="region" aria-label="本句歌詞">正在讀取樂譜…</div>
        <p class="finale-next-line" id="fnNextLine" aria-label="下一句"></p>
        <div class="finale-roll-caption"><span>音符軌道</span><strong id="fnRollCurrent" aria-label="當下音名"></strong></div>
        <div class="finale-roll" id="fnRoll" role="img" aria-label="練唱聲部的音符軌道，音條長度代表時值"><div class="finale-roll-track" id="fnRollTrack" aria-hidden="true"></div><span class="finale-roll-head" id="fnRollHead" aria-hidden="true"></span></div>
        <div class="finale-key-caption"><span id="fnPhraseCount"></span><button class="ghost" id="fnToggleLyrics" aria-expanded="false" aria-controls="fnAllLyrics">顯示全部歌詞</button></div>
        <div class="finale-all-lyrics" id="fnAllLyrics" hidden><p>點選一句，從這裡開始練唱。</p><ol id="fnLyricsList" aria-label="練唱聲部完整歌詞"></ol></div>
      </section>
      <section class="panel" aria-labelledby="fnPianoHeading"><div class="finale-key-caption"><h2 id="fnPianoHeading">一起彈、一起唱</h2><span id="fnLiveNote">點按琴鍵，或用電腦鍵盤彈奏</span></div>
        <div class="finale-keys" id="fnKeyboard" role="group" aria-label="可彈奏的鋼琴"></div>
        <p class="finale-piano-help">A W S E D F T G Y H U J K O L P ; 對應半音階。按住發聲、放開收音；觸控可多指彈奏。練唱聲部即使靜音，仍會顯示歌詞與虛線琴鍵。</p>
      </section>
      <section class="panel finale-console" aria-labelledby="fnConsoleHeading"><h2 id="fnConsoleHeading">練唱控制台</h2>
        <div class="finale-transport"><button class="play" id="fnPlay" disabled>讀取樂譜中…</button><button class="ghost" id="fnStop" disabled>回到開頭</button><span class="finale-time" id="fnTime">0:00 / —</span><label class="chk"><input type="checkbox" id="fnLoop"> 循環播放</label></div>
        <label class="finale-seek-label">播放位置<input class="finale-seek" id="fnSeek" type="range" min="0" max="1" step="0.01" value="0" disabled aria-label="播放位置（秒）"></label>
        <label class="finale-volume finale-master">整體音量<input id="fnMaster" type="range" min="0" max="150" value="100" step="1"><output id="fnMasterOut" for="fnMaster">100%</output></label>
        <div class="finale-metronome"><div class="finale-metro-head"><label class="chk"><input type="checkbox" id="fnMetronome"> 節拍器</label><div class="finale-beats" id="fnBeats" role="group" aria-label="四拍節拍指示">${[1,2,3,4].map(n=>`<span data-beat="${n}">${n}</span>`).join('')}</div><span>隨播放與 BPM 同步，第一拍重音</span></div><label class="finale-volume">節拍音量<input type="range" id="fnMetroVolume" min="0" max="100" value="45"><output id="fnMetroVolumeOut" for="fnMetroVolume">45%</output></label></div>
        <div class="finale-tempo"><label for="fnBpm">起始速度 <span>BPM</span></label><div class="finale-bpm-buttons"><button class="ghost" id="fnBpmDown5" aria-label="速度減少 5 BPM">−5</button><button class="ghost" id="fnBpmDown" aria-label="速度減少 1 BPM">−</button><input id="fnBpm" type="number" min="40" max="200" step="1" value="120" inputmode="numeric" aria-label="起始速度 BPM"><button class="ghost" id="fnBpmUp" aria-label="速度增加 1 BPM">＋</button><button class="ghost" id="fnBpmUp5" aria-label="速度增加 5 BPM">＋5</button><button class="ghost" id="fnTap">敲拍定速</button></div>
        <input id="fnBpmRange" type="range" min="40" max="200" step="1" value="120" aria-label="拖曳調整起始速度 BPM"><p id="fnTempoHint">調慢也不會變調；譜面中的速度變化會一同比例調整。</p></div>
        <div class="finale-focus"><span class="lbl" id="fnFocusLabel">練唱聲部（主畫面歌詞）</span><div class="seg" role="group" aria-labelledby="fnFocusLabel">${voices.map(v=>`<button id="fnFocus-${v.id}" class="${v.id==='f1'?'on':''}" aria-pressed="${v.id==='f1'}">${v.name}</button>`).join('')}</div></div>
        <div class="finale-stereo"><span id="fnStereoSummary">練唱在左，其他在右</span><button class="ghost" id="fnSwap">左右對調 ⇄</button></div>
        <div class="finale-keyboard-controls"><button class="ghost" id="fnOctDown">低八度</button><span id="fnOctave">電腦鍵盤 C4–E5</span><button class="ghost" id="fnOctUp">高八度</button><button class="ghost" id="fnRelease">放開琴鍵</button></div>
        <p class="finale-status" id="fnStatus" role="status">正在讀取四聲部樂譜…</p>
      </section>
      <div class="finale-mix">${voices.map(v=>`<article class="panel finale-voice" data-voice="${v.id}"><div class="finale-voice-head"><h2>${v.name}</h2><a id="fnPdf-${v.id}" target="_blank" rel="noopener">開啟分譜 ↗</a></div><div class="finale-routing"><button class="ghost finale-mute" id="fnMute-${v.id}" aria-pressed="false" aria-label="靜音${v.name}">靜音</button><label><input type="checkbox" id="fnLeft-${v.id}" checked>左 L</label><label><input type="checkbox" id="fnRight-${v.id}" checked>右 R</label></div><label class="finale-volume">音量<input type="range" id="fnVolume-${v.id}" min="0" max="100" value="80"><output id="fnVolumeOut-${v.id}">80%</output></label><p class="finale-part-line" id="fnLyric-${v.id}">—</p><p class="finale-pitch" id="fnPitch-${v.id}">—</p></article>`).join('')}</div></div>`;
    let data=null,context=null,graph=null,playing=false,starting=false,position=0,origin=0,originPosition=0,bpm=120,rate=1,frame=0,timer=null,token=0,focus='f1',baseMidi=60,lyricSignature='',wordNodes=[],loadError=false;
    const muted=new Set(),nodes=new Map(),cursors=new Map(),scheduled=[],held=new Map(),keyTokens=new Map();
    const clicks=[];let nextClickBeat=0;
    let focusSide='left';
    let authEpoch=0,checking=null;
    let rollVoice='',rollNotes=[],lyricsListVoice='',lyricRows=[];
    const beatWidth=80,reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const codes=['KeyA','KeyW','KeyS','KeyE','KeyD','KeyF','KeyT','KeyG','KeyY','KeyH','KeyU','KeyJ','KeyK','KeyO','KeyL','KeyP','Semicolon'];
    const labels=['A','W','S','E','D','F','T','G','Y','H','U','J','K','O','L','P',';'];
    const piano=makePiano($('#fnKeyboard'),36,89,press,32,{interactive:true,onRelease:release,noteName:score.noteName});
    Object.values(piano.keys).forEach(key=>{const shortcut=document.createElement('span');shortcut.className='finale-shortcut';key.appendChild(shortcut);});
    const format=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
    const current=()=>playing?Math.min(data.duration,originPosition+Math.max(0,context.currentTime-origin)*rate):position;
    const enabled=v=>!muted.has(v.id)&&($('#fnLeft-'+v.id).checked||$('#fnRight-'+v.id).checked)&&Number($('#fnVolume-'+v.id).value)>0;
    function status(text){$('#fnStatus').textContent=text;}
    function revealKey(midi,force=false){
      const host=$('#fnKeyboard'),key=piano.keys[midi];if(!key||!host.clientWidth)return;
      const viewport=host.getBoundingClientRect(),rect=key.getBoundingClientRect();
      if(force||rect.left<viewport.left+8||rect.right>viewport.right-8)host.scrollLeft+=rect.left-viewport.left-(host.clientWidth-rect.width)/2;
    }
    function ensureGraph(){
      context=ac();
      if(graph)return;
      const output=context.createGain();output.gain.value=1;
      const compressor=context.createDynamicsCompressor();compressor.threshold.value=-8;compressor.knee.value=12;compressor.ratio.value=4;compressor.attack.value=.003;compressor.release.value=.15;output.connect(compressor);
      const makeup=context.createGain();makeup.gain.value=3;compressor.connect(makeup);
      const master=context.createGain();master.gain.value=Number($('#fnMaster').value)/100;makeup.connect(master);
      const limiter=context.createDynamicsCompressor();limiter.threshold.value=-2;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.001;limiter.release.value=.08;master.connect(limiter);limiter.connect(context.destination);
      const merger=context.createChannelMerger(2);merger.connect(output);
      const live=context.createGain();live.gain.value=.8;live.connect(output);
      const metro=context.createGain();metro.gain.value=Number($('#fnMetroVolume').value)/100;metro.connect(output);
      graph={output,merger,live,master,metro};
      for(const v of voices){
        const input=context.createGain();input.channelCount=1;input.channelCountMode='explicit';
        const left=context.createGain(),right=context.createGain();input.connect(left);input.connect(right);left.connect(merger,0,0);right.connect(merger,0,1);nodes.set(v.id,{input,left,right});route(v);
      }
    }
    function route(v){
      $('#fnVolumeOut-'+v.id).textContent=$('#fnVolume-'+v.id).value+'%';
      const node=nodes.get(v.id);if(!node)return;
      const volume=muted.has(v.id)?0:Number($('#fnVolume-'+v.id).value)/100;
      node.left.gain.setTargetAtTime($('#fnLeft-'+v.id).checked?volume:0,context.currentTime,.008);
      node.right.gain.setTargetAtTime($('#fnRight-'+v.id).checked?volume:0,context.currentTime,.008);
    }
    function stereoSummary(){
      const split=voices.every(v=>$('#fnLeft-'+v.id).checked===(v.id===focus?focusSide==='left':focusSide!=='left')&&$('#fnRight-'+v.id).checked===(v.id===focus?focusSide==='right':focusSide!=='right'));
      $('#fnStereoSummary').textContent=split?`${voices.find(v=>v.id===focus).name} 在${focusSide==='left'?'左':'右'}，其他在${focusSide==='left'?'右':'左'}`:'自訂聲道；選擇練唱聲部可重新分配';
    }
    function splitStereo(){
      for(const v of voices){const left=v.id===focus?focusSide==='left':focusSide!=='left';$('#fnLeft-'+v.id).checked=left;$('#fnRight-'+v.id).checked=!left;route(v);}
      stereoSummary();
    }
    function stopClicks(){while(clicks.length)clicks.pop().stop();}
    function stopScheduled(){while(scheduled.length)scheduled.pop().handle?.stop();stopClicks();}
    function scheduleClick(beat,when){
      const oscillator=context.createOscillator(),gain=context.createGain();
      oscillator.type='sine';oscillator.frequency.value=beat%4===0?1500:1000;
      gain.gain.setValueAtTime(.0001,when);gain.gain.exponentialRampToValueAtTime(.22,when+.001);gain.gain.exponentialRampToValueAtTime(.0001,when+.04);
      oscillator.connect(gain);gain.connect(graph.metro);oscillator.start(when);oscillator.stop(when+.045);
      const click={until:when+.05,stopped:false,stop(){if(this.stopped)return;this.stopped=true;gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setTargetAtTime(.0001,context.currentTime,.002);oscillator.stop(context.currentTime+.01);}};
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};clicks.push(click);
    }
    function pause(){
      const was=playing||starting;token++;position=current();playing=false;starting=false;clearInterval(timer);timer=null;cancelAnimationFrame(frame);stopScheduled();if(was)status('已暫停。鋼琴仍可單獨彈奏。');render();
    }
    function schedule(){
      if(!playing)return;
      const now=current(),horizon=now+.18*rate;
      for(const v of voices){
        const notes=data.voices[v.id].performance;let i=cursors.get(v.id)||0;
        while(i<notes.length&&notes[i].start<=horizon){
          const n=notes[i++];if(n.end<=now+.003*rate)continue;
          const from=Math.max(n.start,originPosition,now),when=Math.max(context.currentTime+.002,origin+(from-originPosition)/rate),duration=(n.end-from)/rate;
          if(duration>.01)scheduled.push({until:when+duration+1.3,handle:pianoNote(n.midi,when,duration,.5,nodes.get(v.id).input)});
        }
        cursors.set(v.id,i);
      }
      for(let i=scheduled.length-1;i>=0;i--)if(scheduled[i].until<context.currentTime)scheduled.splice(i,1);
      if($('#fnMetronome').checked){
        while(nextClickBeat<data.endBeat){const time=data.secondsAt(nextClickBeat);if(time>horizon)break;
          if(time>=now-.01*rate)scheduleClick(nextClickBeat,Math.max(context.currentTime+.002,origin+(time-originPosition)/rate));nextClickBeat++;
        }
      }
      for(let i=clicks.length-1;i>=0;i--)if(clicks[i].until<context.currentTime)clicks.splice(i,1);
    }
    async function start(){
      if(starting||playing||!data)return;const attempt=++token;starting=true;render();
      try{
        ensureGraph();await context.resume();if(attempt!==token||section.hidden)return;
        if(position>=data.duration)position=0;
        origin=context.currentTime+.035;originPosition=position;playing=true;
        nextClickBeat=Math.ceil(data.beatAt(position)-.000001);
        for(const v of voices){const i=data.voices[v.id].performance.findIndex(n=>n.end>position);cursors.set(v.id,i<0?data.voices[v.id].performance.length:i);}
        schedule();timer=setInterval(schedule,25);frame=requestAnimationFrame(tick);status('鋼琴播放中。可同時彈奏，或切換下方聲部控制。');
      }catch{if(attempt===token){playing=false;stopScheduled();status('無法啟動音訊，請再按播放。');}}
      finally{if(attempt===token){starting=false;render();}}
    }
    function tick(){
      if(!playing)return;
      if(current()>=data.duration){const loop=$('#fnLoop').checked;pause();position=loop?0:data.duration;render();if(loop)start();else status('播放結束。');return;}
      render();frame=requestAnimationFrame(tick);
    }
    function seek(value){if(!data)return;const was=playing||starting;pause();position=Math.max(0,Math.min(data.duration,Number(value)||0));render();if(was)start();}
    function setBpm(value){
      const number=Number(value);if(!Number.isFinite(number)||number<40||number>200){$('#fnBpm').value=bpm;status('速度請設定為 40–200 BPM。');return;}
      const was=playing||starting;if(was)pause();bpm=Math.round(number);rate=bpm/120;$('#fnBpm').value=bpm;$('#fnBpmRange').value=bpm;render();if(was)start();
    }
    function phraseAt(part,time){let i=part.phrases.findIndex(p=>p.start>time)-1;if(i===-2)i=part.phrases.length-1;return Math.max(0,i);}
    function renderRoll(time){
      const part=data.voices[focus],host=$('#fnRoll'),track=$('#fnRollTrack'),height=host.clientHeight||240;
      if(rollVoice!==focus){
        rollVoice=focus;rollNotes=[];track.replaceChildren();
        const pitches=part.performance.map(n=>n.midi),low=Math.min(...pitches),high=Math.max(...pitches),span=Math.max(12,high-low),top=high+(span-high+low)/2,step=(height-36)/span;
        track.style.setProperty('--lane-height',step+'px');track.style.width=(data.endBeat*beatWidth+1200)+'px';
        for(const note of part.performance){
          const bar=document.createElement('span');bar.className='finale-roll-note';bar.textContent=score.noteName(note.midi);bar.dataset.beat=note.beat;bar.dataset.endBeat=note.endBeat;bar.dataset.midi=note.midi;
          bar.style.left=(note.beat*beatWidth)+'px';bar.style.width=((note.endBeat-note.beat)*beatWidth-2)+'px';bar.style.top=(18+(top-note.midi)*step)+'px';track.appendChild(bar);rollNotes.push({note,bar});
        }
      }
      const beat=data.beatAt(time),head=Math.min(90,host.clientWidth*.2),page=Math.max(1,Math.floor((host.clientWidth-head)/beatWidth)),from=reducedMotion.matches?Math.floor(beat/page)*page:beat;
      track.style.transform=`translate3d(${head-from*beatWidth}px,0,0)`;$('#fnRollHead').style.left=(head+(beat-from)*beatWidth)+'px';
      let name='';
      for(const {note,bar} of rollNotes){const active=note.start<=time&&time<note.end;bar.classList.toggle('active',active);bar.classList.toggle('past',note.end<=time);if(active){bar.setAttribute('aria-current','true');name=score.noteName(note.midi);}else bar.removeAttribute('aria-current');}
      $('#fnRollCurrent').textContent=name;
    }
    function renderAllLyrics(time){
      if($('#fnAllLyrics').hidden)return;
      const part=data.voices[focus];
      if(lyricsListVoice!==focus){
        lyricsListVoice=focus;lyricRows=[];$('#fnLyricsList').replaceChildren();
        for(const phrase of part.phrases){const row=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=phrase.text;button.dataset.start=phrase.start;row.appendChild(button);$('#fnLyricsList').appendChild(row);lyricRows.push(button);}
      }
      const currentPhrase=phraseAt(part,time);
      lyricRows.forEach((row,i)=>{if(i===currentPhrase)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current');});
    }
    function renderLyrics(time){
      if(!data)return;
      const part=data.voices[focus],index=phraseAt(part,time),phrase=part.phrases[index];
      $('.finale-karaoke').style.setProperty('--voice-color',`var(${voices.find(v=>v.id===focus).color})`);
      $('#fnLyricVoice').textContent=part.name+' · 練唱歌詞'+(muted.has(focus)?'（已靜音，可跟著唱）':'');
      const signature=focus+':'+index;
      if(signature!==lyricSignature){
        lyricSignature=signature;$('#fnCurrentLine').replaceChildren();wordNodes=[];
        if(phrase)for(const word of phrase.words){$('#fnCurrentLine').appendChild(document.createTextNode(word.separator));const span=document.createElement('span');span.textContent=word.text;span.className='finale-word';$('#fnCurrentLine').appendChild(span);wordNodes.push({word,span});}
        else $('#fnCurrentLine').textContent='此聲部沒有歌詞';
        $('#fnPreviousLine').textContent=part.phrases[index-1]?.text||'　';$('#fnNextLine').textContent=part.phrases[index+1]?'下一句　'+part.phrases[index+1].text:'　';$('#fnPhraseCount').textContent=phrase?`第 ${index+1} / ${part.phrases.length} 句`:'';
      }
      for(const {word,span} of wordNodes){const active=word.start<=time&&time<word.end;span.classList.toggle('sung',time>=word.end);span.classList.toggle('singing',active);span.style.setProperty('--word-progress',(Math.max(0,Math.min(1,(time-word.start)/(word.end-word.start)))*100)+'%');if(active)span.setAttribute('aria-current','true');else span.removeAttribute('aria-current');}
    }
    function render(){
      const t=current();$('#fnTime').textContent=format(t)+' / '+(data?format(data.duration):'—');$('#fnSeek').value=t;
      $('#fnPlay').disabled=starting||(!data&&!loadError);$('#fnPlay').textContent=loadError?'重新讀取樂譜':!data?'讀取樂譜中…':starting?'準備播放…':playing?'暫停':'播放';
      const lit=new Map();
      function light(midi,label,color,hollow){if(!lit.has(midi))lit.set(midi,[]);lit.get(midi).push({label,color,hollow});}
      if(data){
        renderLyrics(t);
        renderRoll(t);renderAllLyrics(t);
        const activeBeat=Math.floor(data.beatAt(t)+.000001)%4+1;
        for(const light of $('#fnBeats').children){const active=playing&&$('#fnMetronome').checked&&Number(light.dataset.beat)===activeBeat;light.classList.toggle('active',active);if(active)light.setAttribute('aria-current','true');else light.removeAttribute('aria-current');}
        for(const v of voices){
          const part=data.voices[v.id],notes=score.activeAt(part.notes,t),phrase=part.phrases[phraseAt(part,t)];
          $('#fnLyric-'+v.id).textContent=phrase?.text||'—';$('#fnPitch-'+v.id).textContent=(muted.has(v.id)?'已靜音 · ':'')+(notes.length?notes.map(n=>score.noteName(n.midi)).join(' · '):'休止');
          if(playing&&(enabled(v)||v.id===focus))for(const n of notes)light(n.midi,v.name,`var(${v.color})`,!enabled(v));
        }
        let tempo=data.tempos[0];for(const mark of data.tempos)if(data.secondsAt(mark.beat)<=t)tempo=mark;
        $('#fnTempoHint').textContent=`目前 ${Math.round(tempo.bpm*rate)} BPM · 調慢也不會變調；譜面中的速度變化會一同比例調整。`;
        if(playing&&!held.size){const note=score.activeAt(data.voices[focus].notes,t)[0];if(note)revealKey(note.midi);}
      }
      for(const [midi] of held)light(midi,'彈奏','var(--gold-hi)',false);
      piano.setLit([...lit].map(([midi,items])=>({midi,label:[...new Set(items.map(x=>x.label))].join('／'),color:items.length>1?'var(--gold-hi)':items[0].color,hollow:items.every(x=>x.hollow)})));
      $('#fnLiveNote').textContent=held.size?[...held.keys()].sort((a,b)=>a-b).map(score.noteName).join(' · '):'點按琴鍵，或用電腦鍵盤彈奏';
    }
    function press(midi,key){
      if(section.hidden||$('#fnRoom').hidden||keyTokens.has(key))return;
      try{ensureGraph();keyTokens.set(key,midi);if(!held.has(midi))held.set(midi,{keys:new Set(),handle:pianoNote(midi,0,60,.65,graph.live)});held.get(midi).keys.add(key);render();if(key.startsWith('keyboard:'))revealKey(midi);}
      catch{keyTokens.delete(key);status('無法啟動鋼琴，請再點一次琴鍵。');}
    }
    function release(midi,key){
      if(!keyTokens.has(key))return;midi=keyTokens.get(key);keyTokens.delete(key);const entry=held.get(midi);if(!entry)return;entry.keys.delete(key);if(!entry.keys.size){entry.handle?.stop();held.delete(midi);}render();
    }
    function releaseAll(){for(const entry of held.values())entry.handle?.stop();held.clear();keyTokens.clear();render();}
    function keyboardLabels(){
      for(const key of Object.values(piano.keys)){key.querySelector('.finale-shortcut').textContent='';key.removeAttribute('aria-keyshortcuts');}
      codes.forEach((code,i)=>{const key=piano.keys[baseMidi+i];key.querySelector('.finale-shortcut').textContent=labels[i];key.setAttribute('aria-keyshortcuts',labels[i]);});
      $('#fnOctave').textContent='電腦鍵盤 '+score.noteName(baseMidi)+'–'+score.noteName(baseMidi+16);$('#fnOctDown').disabled=baseMidi<=36;$('#fnOctUp').disabled=baseMidi>=72;
      if(!section.hidden)requestAnimationFrame(()=>revealKey(baseMidi,true));
    }
    $('#fnPlay').onclick=()=>{if(loadError)load();else if(playing)pause();else start();};$('#fnStop').onclick=()=>{pause();position=0;render();status('已回到開頭。');};$('#fnSeek').oninput=e=>seek(e.target.value);
    $('#fnBpm').onchange=e=>setBpm(e.target.value);$('#fnBpmRange').oninput=e=>setBpm(e.target.value);
    $('#fnMaster').oninput=e=>{const volume=Number(e.target.value);$('#fnMasterOut').textContent=volume+'%';if(graph)graph.master.gain.setTargetAtTime(volume/100,context.currentTime,.008);};
    $('#fnMetronome').onchange=()=>{stopClicks();if(data)nextClickBeat=Math.ceil(data.beatAt(current())-.000001);if(playing)schedule();render();};
    $('#fnMetroVolume').oninput=e=>{const volume=Number(e.target.value);$('#fnMetroVolumeOut').textContent=volume+'%';if(graph)graph.metro.gain.setTargetAtTime(volume/100,context.currentTime,.008);};
    $('#fnToggleLyrics').onclick=()=>{const expanded=$('#fnAllLyrics').hidden;$('#fnAllLyrics').hidden=!expanded;$('#fnToggleLyrics').setAttribute('aria-expanded',String(expanded));$('#fnToggleLyrics').textContent=expanded?'收起全部歌詞':'顯示全部歌詞';render();};
    $('#fnLyricsList').onclick=event=>{const row=event.target.closest('button[data-start]');if(row)seek(Number(row.dataset.start));};
    $('#fnSwap').onclick=()=>{focusSide=focusSide==='left'?'right':'left';splitStereo();};
    for(const [id,delta] of [['fnBpmDown5',-5],['fnBpmDown',-1],['fnBpmUp',1],['fnBpmUp5',5]])$('#'+id).onclick=()=>setBpm(Math.max(40,Math.min(200,bpm+delta)));
    let taps=[];$('#fnTap').onclick=()=>{const now=performance.now();if(taps.length&&now-taps[taps.length-1]>2000)taps=[];taps.push(now);taps=taps.slice(-6);if(taps.length<2){status('繼續敲拍以設定速度。');return;}const intervals=taps.slice(1).map((t,i)=>t-taps[i]);setBpm(Math.max(40,Math.min(200,60000/(intervals.reduce((a,b)=>a+b,0)/intervals.length))));status('已依敲拍設定為 '+bpm+' BPM。');};
    $('#fnOctDown').onclick=()=>{releaseAll();baseMidi=Math.max(36,baseMidi-12);keyboardLabels();};$('#fnOctUp').onclick=()=>{releaseAll();baseMidi=Math.min(72,baseMidi+12);keyboardLabels();};$('#fnRelease').onclick=releaseAll;
    for(const v of voices){
      $('#fnMute-'+v.id).onclick=()=>{muted.has(v.id)?muted.delete(v.id):muted.add(v.id);const m=muted.has(v.id),button=$('#fnMute-'+v.id);button.setAttribute('aria-pressed',String(m));button.setAttribute('aria-label',(m?'開啟':'靜音')+v.name);button.textContent=m?'開啟聲部':'靜音';route(v);render();};
      ['Left','Right','Volume'].forEach(kind=>$('#fn'+kind+'-'+v.id).addEventListener('input',()=>{route(v);stereoSummary();render();}));
      $('#fnFocus-'+v.id).onclick=()=>{focus=v.id;splitStereo();for(const other of voices){const button=$('#fnFocus-'+other.id);button.classList.toggle('on',other.id===focus);button.setAttribute('aria-pressed',String(other.id===focus));}render();if(data)revealKey(score.activeAt(data.voices[focus].notes,current())[0]?.midi??baseMidi,true);};
    }
    document.addEventListener('keydown',e=>{if(section.hidden||$('#fnRoom').hidden||e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable]'))return;const i=codes.indexOf(e.code);if(i<0)return;e.preventDefault();press(baseMidi+i,'keyboard:'+e.code);});
    document.addEventListener('keyup',e=>{const key='keyboard:'+e.code;if(keyTokens.has(key)){e.preventDefault();release(keyTokens.get(key),key);}});
    window.addEventListener('blur',releaseAll);document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();releaseAll();}});
    new MutationObserver(()=>{if(section.hidden){pause();releaseAll();}else requestAnimationFrame(()=>revealKey(data?.voices[focus].notes[0]?.midi??baseMidi,true));}).observe(section,{attributes:true,attributeFilter:['hidden']});
    new ResizeObserver(()=>{if(!section.hidden&&!held.size)revealKey(data?score.activeAt(data.voices[focus].notes,current())[0]?.midi??baseMidi:baseMidi,true);}).observe($('#fnKeyboard'));
    new ResizeObserver(()=>{if(data&&!section.hidden)renderRoll(current());}).observe($('#fnRoll'));
    async function load(){
      const attempt=authEpoch;
      loadError=false;data=null;section.setAttribute('aria-busy','true');render();
      try{
        const response=await fetch('/api/finale/score',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});if(attempt!==authEpoch)return;if(response.status===401){lock('登入已到期，請重新輸入密碼。');return;}if(!response.ok)throw Error();const prepared=score.prepare(await response.json());if(attempt!==authEpoch)return;data=prepared;
        for(const v of voices)$('#fnPdf-'+v.id).href=data.voices[v.id].pdf;
        $('#fnSeek').max=data.duration;$('#fnSeek').disabled=false;$('#fnStop').disabled=false;lyricSignature='';rollVoice='';lyricsListVoice='';status('樂譜已就緒，按播放即可練唱。鋼琴也可以單獨彈奏。');requestAnimationFrame(()=>{if(data)revealKey(data.voices[focus].notes[0].midi,true);});
      }catch{if(attempt!==authEpoch)return;data=null;loadError=true;$('#fnCurrentLine').textContent='樂譜讀取失敗';status('請確認網路後按「重新讀取樂譜」。鋼琴仍可彈奏。');}
      finally{section.removeAttribute('aria-busy');render();}
    }
    function lock(message){
      authEpoch++;pause();releaseAll();data=null;position=0;loadError=false;lyricSignature='';wordNodes=[];
      $('#fnRoom').hidden=true;$('#fnAuth').hidden=false;$('#fnCurrentLine').textContent='請先登入';
      for(const v of voices){$('#fnPdf-'+v.id).removeAttribute('href');$('#fnLyric-'+v.id).textContent='—';$('#fnPitch-'+v.id).textContent='—';}
      $('#fnPreviousLine').textContent='';$('#fnNextLine').textContent='';$('#fnAuthStatus').textContent=message;render();
      $('#fnPhraseCount').textContent='';$('#fnRollTrack').replaceChildren();$('#fnRollCurrent').textContent='';rollVoice='';rollNotes=[];$('#fnLyricsList').replaceChildren();lyricsListVoice='';lyricRows=[];$('#fnSeek').disabled=true;$('#fnStop').disabled=true;
    }
    function checkSession(){
      if(checking)return checking;const attempt=authEpoch;
      const operation=(async()=>{try{const response=await fetch('/api/finale/session',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});if(attempt!==authEpoch)return;
        if(response.ok){$('#fnAuthRetry').hidden=true;$('#fnAuth').hidden=true;if($('#fnRoom').hidden){$('#fnRoom').hidden=false;load();}}
        else if(response.status===401){lock('請輸入練唱密碼。');$('#fnAuthRetry').hidden=true;}
        else throw Error();
      }catch{if(attempt===authEpoch){lock('練唱服務暫時無法連線，請確認網路與服務設定。');$('#fnAuthRetry').hidden=false;}}
      })();checking=operation;operation.finally(()=>{if(checking===operation)checking=null;});return operation;
    }
    $('#fnLogin').onsubmit=async event=>{
      event.preventDefault();const button=$('#fnUnlock');if(button.disabled)return;button.disabled=true;button.textContent='驗證中…';$('#fnAuthStatus').textContent='';let attempt=authEpoch;
      try{const password=$('#fnPassword').value;$('#fnPassword').value='';if(checking)await checking;attempt=authEpoch;const response=await fetch('/api/finale/login',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({password}),signal:AbortSignal.timeout(10000)});if(attempt!==authEpoch)return;
        const result=await response.json();if(!response.ok){$('#fnAuthStatus').textContent=result.error||'無法登入，請稍後再試。';$('#fnPassword').focus();return;}
        await checkSession();
      }catch{if(attempt===authEpoch)$('#fnAuthStatus').textContent='無法連線，請稍後再試。';}
      finally{button.disabled=false;button.textContent='進入練唱室';}
    };
    $('#fnLogout').onclick=async()=>{
      const button=$('#fnLogout');button.disabled=true;pause();releaseAll();
      try{const response=await fetch('/api/finale/logout',{method:'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();lock('已登出練唱室。');$('#fnPassword').focus();}
      catch{status('登出未完成，請確認網路後重試。');}
      finally{button.disabled=false;}
    };
    $('#fnAuthRetry').onclick=checkSession;
    setInterval(()=>{if(!$('#fnRoom').hidden&&!document.hidden)checkSession();},60000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('#fnRoom').hidden)checkSession();});
    splitStereo();keyboardLabels();checkSession();return {pause};
  };
})();
