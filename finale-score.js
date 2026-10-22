/* A single score timeline drives sound, key highlights and lyrics. */
(function(root){
  'use strict';
  const names=['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
  const noteName=m=>names[m%12]+(Math.floor(m/12)-1);
  function validate(events){
    if(!Array.isArray(events)||events.length>50000)throw Error('音符資料格式不正確。');
    return events.map(e=>{
      if(!Number.isFinite(e.start)||!Number.isFinite(e.end)||e.start<0||e.end<=e.start||!Number.isInteger(e.midi)||e.midi<0||e.midi>127)throw Error('音符時間或音高不正確。');
      return {start:e.start,end:e.end,midi:e.midi,lyric:String(e.lyric||'').slice(0,500)};
    }).sort((a,b)=>a.start-b.start);
  }
  function activeAt(events,time){return events.filter(e=>e.start<=time&&time<e.end);}
  function lyricPhrases(notes){
    const tokens=[];
    for(const n of notes){
      if((n.tieFromPrevious||!n.lyric)&&tokens.length&&Math.abs(tokens[tokens.length-1].end-n.start)<.00001){tokens[tokens.length-1].end=n.end;continue;}
      if(n.lyric)tokens.push({text:n.lyric,start:n.start,end:n.end,separator:' '});
    }
    const clean=t=>t.toLowerCase().replace(/[^a-z]/g,'');
    const compounds=[['com','in'],['lov','ing'],['leav','ing'],['want','ing'],['be','fore'],['whirl','wind'],['dis','ease'],['ba','by'],['de','li','cious'],['vi','cious'],['re','verse'],['wring','er'],['per','fect'],['some','how'],['reck','less'],['here','by'],['con','cede'],['sur','vive']];
    for(let i=0;i<tokens.length;i++){
      for(const parts of compounds){
        if(parts.every((part,j)=>tokens[i+j]&&clean(tokens[i+j].text)===part))for(let j=1;j<parts.length;j++)tokens[i+j].separator='';
      }
      if(i&&['goo','eyed'].includes(clean(tokens[i].text))&&clean(tokens[i-1].text)==='goo')tokens[i].separator='-';
      if(i&&((clean(tokens[i-1].text)==='drip'&&clean(tokens[i].text)==='dried')||(clean(tokens[i-1].text)==='love'&&clean(tokens[i].text)==='sick')))tokens[i].separator='-';
    }
    const phrases=[];let words=[];
    function flush(){if(!words.length)return;words[0].separator='';phrases.push({start:words[0].start,end:words[words.length-1].end,words,text:words.map(w=>w.separator+w.text).join('')});words=[];}
    for(let i=0;i<tokens.length;i++){
      const token=tokens[i],canBreak=!tokens[i+1]||tokens[i+1].separator===' ';
      const previous=words[words.length-1],last=previous&&clean(previous.text),word=clean(token.text);
      const lineLength=words.map(w=>w.text).join(' ').length;
      if(words.length&&((token.start-previous.end>1.5&&!(last==='now'&&word==='change'))||word==='hi'||word==='well'||(word==='loves'&&last!=='if')||(word==='i'&&['change','say'].includes(last))||((word==='i'||word==='keep'||word==='baby')&&last==='back')||(lineLength>=38&&['of','and','but'].includes(word)&&token.separator===' ')))flush();
      words.push(token);
      const remaining=tokens.slice(i+1).findIndex(t=>/[;.!?]$/.test(t.text));
      const nearEnd=remaining>=0&&remaining<=2;
      const weakEnding=['of','to','and','but','if','a','the','this','in','with'].includes(word);
      if(/[;.!?]$/.test(token.text)||(canBreak&&((/,$/.test(token.text)&&words.length>=4)||(!nearEnd&&!weakEnding&&(words.length>=11||words.map(w=>w.text).join('').length>64)))))flush();
    }
    flush();return phrases;
  }
  function prepare(data){
    if(data?.version!==1||data.kind!=='score-piano'||!Number.isFinite(data.endBeat)||data.endBeat<=0||data.endBeat>10000)throw Error('樂譜資料格式不正確。');
    if(!Array.isArray(data.tempos)||!data.tempos.length||data.tempos[0].beat!==0)throw Error('樂譜缺少起始速度。');
    const tempos=data.tempos.map((t,i)=>{
      if(!Number.isFinite(t.beat)||t.beat<0||!Number.isFinite(t.bpm)||t.bpm<20||t.bpm>400||(i&&t.beat<=data.tempos[i-1].beat))throw Error('樂譜速度標記不正確。');
      return {beat:t.beat,bpm:t.bpm};
    });
    function secondsAt(beat){
      let time=0;
      for(let i=0;i<tempos.length&&tempos[i].beat<beat;i++)time+=(Math.min(beat,tempos[i+1]?.beat??beat)-tempos[i].beat)*60/tempos[i].bpm;
      return time;
    }
    function beatAt(time){
      time=Math.max(0,Math.min(secondsAt(data.endBeat),time));
      for(let i=tempos.length-1;i>=0;i--){const start=secondsAt(tempos[i].beat);if(time>=start)return tempos[i].beat+(time-start)*tempos[i].bpm/60;}
      return 0;
    }
    const voices={};
    for(const id of ['f1','f2','m1','m2']){
      const part=data.voices?.[id];if(!part||!Array.isArray(part.notes)||!part.notes.length||part.notes.length>10000)throw Error('樂譜缺少聲部音符。');
      let previous=-1;
      const notes=part.notes.map(n=>{
        if(!Number.isFinite(n.beat)||!Number.isFinite(n.endBeat)||n.beat<0||n.beat<previous||n.endBeat<=n.beat||n.endBeat>data.endBeat||!Number.isInteger(n.midi)||n.midi<0||n.midi>127)throw Error('樂譜音高或節奏不正確。');
        previous=n.beat;
        return {...n,lyric:String(n.lyric||'').slice(0,500),start:secondsAt(n.beat),end:secondsAt(n.endBeat)};
      });
      const performance=[];
      for(const n of notes){
        const last=performance[performance.length-1];
        if(n.tieFromPrevious&&last&&n.midi===last.midi&&Math.abs(last.end-n.start)<.00001){last.end=n.end;last.endBeat=n.endBeat;}
        else performance.push({midi:n.midi,start:n.start,end:n.end,beat:n.beat,endBeat:n.endBeat});
      }
      const rhythm=[];let endBeat=0;
      for(const n of performance){
        if(n.beat>endBeat)rhythm.push({kind:'rest',beat:endBeat,endBeat:n.beat,start:secondsAt(endBeat),end:n.start});
        rhythm.push({...n,kind:'note'});endBeat=n.endBeat;
      }
      if(endBeat<data.endBeat)rhythm.push({kind:'rest',beat:endBeat,endBeat:data.endBeat,start:secondsAt(endBeat),end:secondsAt(data.endBeat)});
      voices[id]={...part,notes,performance,rhythm,phrases:lyricPhrases(notes)};
    }
    return {...data,tempos,voices,duration:secondsAt(data.endBeat),secondsAt,beatAt};
  }
  const api={noteName,validate,activeAt,prepare,lyricPhrases};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.FinaleScore=api;
})(typeof window==='undefined'?globalThis:window);
