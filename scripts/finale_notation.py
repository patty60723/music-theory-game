"""Vector notation and lyric-coordinate reader shared by score tools.

Only PyMuPDF is needed; no audio decoder or MP3 data is used here.
"""
import json
from pathlib import Path
import fitz

ROOT = Path(__file__).resolve().parents[1]
VOICES = {'f1': '女_1', 'f2': '女_2', 'm1': '男_1', 'm2': '男_2'}
NOTEHEADS = {'\ue0a2': 4., '\ue0a3': 2., '\ue0a4': 1.}
RESTS = {'\ue4e3': 4., '\ue4e4': 2., '\ue4e5': 1., '\ue4e6': .5, '\ue4e7': .25, '\ue4e8': .125}
FLAGS = {'\ue240': .5, '\ue241': .5, '\ue242': .25, '\ue243': .25, '\ue244': .125, '\ue245': .125}


def read_score(pdf):
    document = fitz.open(pdf)
    measures = []
    for pi, page in enumerate(document):
        chars, texts = [], []
        for block in page.get_text('rawdict')['blocks']:
            for line in block.get('lines', []):
                for span in line['spans']:
                    if span['font'] == 'Leland':
                        chars.extend(span['chars'])
                    else:
                        text = ''.join(c['c'] for c in span['chars']).strip()
                        texts.append((text, span['font'], span['size'], span['origin'], span['bbox']))
        paths = page.get_drawings()
        lines = [(item, d['width']) for d in paths for item in d['items'] if item[0] == 'l']
        clefs = sorted((c for c in chars if c['c'] == '\ue050'), key=lambda c: c['origin'][1])
        for clef in clefs:
            cx, gy = clef['origin']
            bars = sorted({round(i[1].x, 2) for i, width in lines if width and .8 < width < 1.1 and abs(i[1].x-i[2].x) < .1 and min(i[1].y,i[2].y) < gy-10 and max(i[1].y,i[2].y) > gy+4})
            # A double bar is one boundary, not an extra empty measure.
            bounds = [cx-8]
            for x in bars:
                if x-bounds[-1] > 5:
                    bounds.append(x)
            syms = [c for c in chars if abs(c['origin'][1]-gy) < 35]
            for left, right in zip(bounds, bounds[1:]):
                symbols = sorted((c for c in syms if left < c['origin'][0] < right and c['c'] in NOTEHEADS.keys() | RESTS.keys()), key=lambda c:c['origin'][0])
                events = []
                for c in symbols:
                    x,y=c['origin'];is_note=c['c'] in NOTEHEADS
                    dur=(NOTEHEADS if is_note else RESTS)[c['c']]
                    if is_note and dur == 1:
                        stems = [(i,width) for i,width in lines if width and .45 < width < .55 and abs(i[1].x-i[2].x)<.1 and min(abs(i[1].y-y),abs(i[2].y-y))<1.3 and -.5<i[1].x-x<7]
                        if stems:
                            stem=stems[0][0];sx=stem[1].x;end=stem[1].y if abs(stem[1].y-y)>abs(stem[2].y-y) else stem[2].y
                            flag=[f for f in syms if f['c'] in FLAGS and abs(f['origin'][0]-sx)<1 and abs(f['origin'][1]-end)<1]
                            if flag:
                                dur=FLAGS[flag[0]['c']]
                            else:
                                beams=[d for d in paths if d['fill']==(0.,0.,0.) and all(i[0]=='l' for i in d['items']) and d['rect'].width>5 and d['rect'].height<12 and d['rect'].x0-.4<=sx<=d['rect'].x1+.4 and min(abs(d['rect'].y0-end),abs(d['rect'].y1-end))<7]
                                if beams:
                                    dur=.5**len(beams)
                    dots=[d for d in syms if d['c']=='\ue1e7' and 6<x and 0<d['origin'][0]-x<13 and abs(d['origin'][1]-y)<3]
                    if dots:
                        dur*=1.5
                    accidentals=[a for a in syms if a['c'] in ('\ue260','\ue261','\ue262') and 0<x-a['origin'][0]<12 and abs(a['origin'][1]-y)<.6]
                    accidental={'\ue260':-1,'\ue261':0,'\ue262':1}[max(accidentals,key=lambda a:a['origin'][0])['c']] if accidentals else None
                    events.append({'x':x,'y':y,'duration':dur,'note':is_note,'accidental':accidental,'glyph':c['c'],'page':pi,'px':round(x/page.rect.width,6),'py':round(y/page.rect.height,6)})
                # Numbered multi-measure rests use a filled rectangular H bar.
                if not symbols:
                    count=[ord(c['c'])-0xe080 for c in syms if 0xe081<=ord(c['c'])<=0xe089 and left<c['origin'][0]<right and gy-30<c['origin'][1]<gy]
                    measures.append({'events':[],'beats':4*count[0] if count else 4,'page':pi,'left':left,'right':right,'gy':gy})
                    continue
                if len(events)==1 and not events[0]['note']:
                    events[0]['duration']=4.
                # Quarter-note triplets: the numeral is above a bracket whose
                # two x endpoints delimit exactly three notes.
                tuplets=[t for t in texts if t[0]=='3' and left<t[3][0]<right and gy-40<t[3][1]<gy and t[2]<12]
                for t in tuplets:
                    tx,ty=t[3]
                    bracket=[d for d in paths if d['type']=='s' and 5<d['rect'].width<60 and abs(d['rect'].y0-ty)<8]
                    before=[d for d in bracket if 0<tx-d['rect'].x1<15]
                    after=[d for d in bracket if 0<d['rect'].x0-t[4][2]<15]
                    if before and after:
                        a=min(before,key=lambda d:tx-d['rect'].x1)['rect'].x0-7
                        b=min(after,key=lambda d:d['rect'].x0-t[4][2])['rect'].x1+1
                        near=[e for e in events if a<e['x']<b]
                    else:
                        near=sorted((e for e in events if e['note']),key=lambda e:abs(e['x']-tx))[:3]
                    if sum(e['duration'] for e in events)>4.01:
                        for e in near:e['duration']*=2/3
                total=sum(e['duration'] for e in events)
                cursor=0
                for e in events:e['offset']=cursor;cursor+=e['duration']
                measures.append({'events':events,'beats':4,'total':total,'page':pi,'left':left,'right':right,'gy':gy})
    return measures


def inspect():
    for voice,suffix in VOICES.items():
        measures=read_score(next((ROOT/'assets').glob('*-'+suffix+'.pdf')))
        bad=[(i+1,round(m.get('total',m['beats']),3),[(round(e['x'],1),e['glyph'].encode('unicode_escape').decode(),e['duration']) for e in m['events']]) for i,m in enumerate(measures) if abs(m.get('total',m['beats'])-m['beats'])>.01]
        print(voice,'measures',len(measures),'beats',sum(m['beats'] for m in measures),'notes',sum(e['note'] for m in measures for e in m['events']),'irregular',json.dumps(bad))


def notation_events(drafts):
    result={}
    for voice,suffix in VOICES.items():
        measures=read_score(next((ROOT/'assets').glob('*-'+suffix+'.pdf')))
        events=[];beat=0.
        for measure in measures:
            if abs(measure.get('total',measure['beats'])-measure['beats'])>.01:
                raise ValueError(f'Unresolved rhythm in {voice}, beat {beat}: {measure}')
            local_accidentals={}
            for e in measure['events']:
                if e['note']:
                    matches=[(i,n) for i,n in enumerate(drafts['voices'][voice]['notes']) if n['page']==e['page'] and abs(n['x']-e['px'])<.00001 and abs(n['y']-e['py'])<.00001]
                    if len(matches)!=1:raise ValueError(f'Ambiguous note correspondence: {voice} {e}')
                    i,n=matches[0]
                    # Key changes can occur inside a printed system. The initial
                    # geometric extractor did not follow these changes.
                    absolute=beat+e['offset']
                    sharp_key=(144<=absolute<192) or absolute>=208
                    key={'F':1,'C':1} if sharp_key else {letter:-1 for letter in 'BEADG'}
                    diatonic=4*7+4+round((measure['gy']-e['y'])/2.480315)
                    octave,degree=divmod(diatonic,7);letter='CDEFGAB'[degree]
                    if e['accidental'] is not None:local_accidentals[(letter,octave)]=e['accidental']
                    alter=local_accidentals.get((letter,octave),key.get(letter,0))
                    midi=(octave+1)*12+[0,2,4,5,7,9,11][degree]+alter
                    events.append({**n,'lyric':n.get('sourceLyric',n['lyric']),'midi':midi,'index':i,'beat':absolute,'endBeat':absolute+e['duration']})
            beat+=measure['beats']
        if len(events)!=len(drafts['voices'][voice]['notes']):raise ValueError('Missing notation events')
        result[voice]=events
    return result
