"""Build the piano score from the PDFs' note pitches, rhythms and lyrics.

No MP3 alignment times, confidence values or browser review progress are used.
Retained lyric coordinates come from the current score JSON.
"""
import hashlib
import json

from finale_notation import ROOT, notation_events

drafts=json.loads((ROOT/'assets/finale-score.json').read_text(encoding='utf-8'))
for part in drafts['voices'].values():
    for note in part['notes']:
        note['sourceLyric']='' if note.get('tieFromPrevious') else note['lyric']
events=notation_events(drafts)
output={'version':1,'kind':'score-piano','title':'I Love You, You’re Perfect, Now Change · Finale','endBeat':260,'tempos':[{'beat':0,'bpm':120},{'beat':96,'bpm':126},{'beat':144,'bpm':132}],'voices':{},'sources':{}}
for voice,notes in events.items():
    generated=[]
    for n in notes:
        tied=bool(generated and not n['lyric'] and n['midi']==generated[-1]['midi'] and abs(n['beat']-generated[-1]['endBeat'])<.00001)
        lyric=generated[-1]['lyric'] if tied else n['lyric']
        generated.append({'beat':round(n['beat'],6),'endBeat':round(n['endBeat'],6),'midi':n['midi'],'lyric':lyric,'tieFromPrevious':tied,'page':n['page'],'x':n['x'],'y':n['y']})
    source=drafts['voices'][voice]
    output['voices'][voice]={'name':{'f1':'女 1','f2':'女 2','m1':'男 1','m2':'男 2'}[voice],'pdf':source['pdf'],'notes':generated}
    pdf=ROOT/source['pdf'];output['sources'][pdf.name]=hashlib.sha256(pdf.read_bytes()).hexdigest()
(ROOT/'assets/finale-score.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print({v:len(p['notes']) for v,p in output['voices'].items()})
