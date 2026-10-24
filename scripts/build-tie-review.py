"""Generate a PRIVATE A/B review bundle from PDF tie geometry. Never edits the score."""
import base64
import copy
import hashlib
import io
import json
from pathlib import Path

import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def review_part(part):
    document = fitz.open(ROOT / part['pdf'])
    notes, curves, staffs = [], [], {}
    for page_index, page in enumerate(document):
        staffs[page_index] = [c['origin'][1]
            for block in page.get_text('rawdict')['blocks']
            for line in block.get('lines', []) for span in line['spans']
            for c in span['chars'] if c['c'] == '\ue050']
        for drawing in page.get_drawings():
            if len(drawing['items']) == 2 and all(item[0] == 'c' for item in drawing['items']):
                curves.append((page_index, drawing['items'][0][1], drawing['items'][0][4]))
    for note in part['notes']:
        page = document[note['page']]
        x, y = note['x'] * page.rect.width, note['y'] * page.rect.height
        staff = min(staffs[note['page']], key=lambda gy: abs(gy-y))
        notes.append({**note, 'px': x, 'py': y, 'writtenPitch': round((staff-y)/2.480315)})
    ties = set()
    for index, note in enumerate(notes[1:], 1):
        previous = notes[index-1]
        if abs(note['beat']-previous['endBeat']) > .00001 or note['writtenPitch'] != previous['writtenPitch']:
            continue
        if note['page'] == previous['page'] and abs(note['py']-previous['py']) < 1:
            matches = [c for c in curves if c[0] == note['page']
                and 2 < c[1].x-previous['px'] < 6 and 1 < c[2].x-note['px'] < 5
                and abs(c[1].y-c[2].y) < 1 and abs(abs(c[1].y-previous['py'])-3.6215) < 1]
            if len(matches) == 1:
                ties.add(index)
        else:
            starts = [c for c in curves if c[0] == previous['page']
                and 2 < c[1].x-previous['px'] < 6 and abs(abs(c[1].y-previous['py'])-3.6215) < 1]
            ends = [c for c in curves if c[0] == note['page']
                and 1 < c[2].x-note['px'] < 5 and abs(abs(c[2].y-note['py'])-3.6215) < 1]
            if len(starts) == len(ends) == 1:
                ties.add(index)
    return document, notes, ties


def crop_pair(document, previous, note):
    points = [previous, note] if previous['page'] != note['page'] or abs(previous['py']-note['py']) > 10 else [None]
    strips = []
    for point in points:
        page = document[(point or note)['page']]
        if point:
            x0, x1, y = point['px']-48, point['px']+48, point['py']
        else:
            x0, x1, y = previous['px']-40, note['px']+45, note['py']
        area = fitz.Rect(max(0, x0), max(0, y-36), min(page.rect.width, x1), min(page.rect.height, y+34))
        pixmap = page.get_pixmap(matrix=fitz.Matrix(3, 3), clip=area)
        strips.append(Image.frombytes('RGB', [pixmap.width, pixmap.height], pixmap.samples))
    image = Image.new('RGB', (max(s.width for s in strips), sum(s.height for s in strips)+12*(len(strips)-1)), 'white')
    y = 0
    for strip in strips:
        image.paste(strip, (0, y)); y += strip.height+12
    buffer = io.BytesIO(); image.save(buffer, format='PNG', optimize=True)
    return 'data:image/png;base64,'+base64.b64encode(buffer.getvalue()).decode('ascii')


def build_review():
    source = ROOT/'assets/finale-score.json'
    original = json.loads(source.read_text(encoding='utf8'))
    proposed = copy.deepcopy(original)
    cases, totals = [], {'verifiedTies': 0, 'missing': 0, 'incorrect': 0, 'pitch': 0, 'lyricChains': 0}
    for voice, part in original['voices'].items():
        document, notes, ties = review_part(part)
        updated = proposed['voices'][voice]['notes']
        # Old inferred continuation labels are not printed lyric evidence.
        printed = ['' if n.get('tieFromPrevious') else n['lyric'] for n in notes]
        for index, note in enumerate(updated):
            note['tieFromPrevious'] = index in ties
            note['lyric'] = printed[index]
            if index in ties:
                note['midi'] = updated[index-1]['midi']
        start = 0
        while start < len(updated):
            end = start+1
            while end < len(updated) and end in ties:
                end += 1
            words = list(dict.fromkeys(w for w in printed[start:end] if w))
            if len(words) > 1:
                raise ValueError(f'Conflicting printed lyrics in {voice}, note {start}: {words}')
            lyric = words[0] if words else ''
            if len(updated[start:end]) > 1 and updated[start]['lyric'] != lyric:
                totals['lyricChains'] += 1
            for index in range(start, end):
                updated[index]['lyric'] = lyric
            start = end
        totals['verifiedTies'] += len(ties)
        for index, note in enumerate(notes):
            if bool(note.get('tieFromPrevious')) == (index in ties):
                continue
            previous = notes[index-1]
            kind = 'missing' if index in ties else 'incorrect'
            pitch = note['midi'] != updated[index]['midi']
            totals[kind] += 1; totals['pitch'] += pitch
            # Include complete current/proposed chains, with equal context for A/B.
            low = index-1
            while low > 0 and (notes[low].get('tieFromPrevious') or low in ties):
                low -= 1
            high = index
            while high+1 < len(notes) and (notes[high+1].get('tieFromPrevious') or high+1 in ties):
                high += 1
            start_beat = max(0, notes[low]['beat']-1)
            end_beat = min(original['endBeat'], max(notes[high]['endBeat'], updated[high]['endBeat'])+1)
            cases.append({'id': f'{voice}-{index}', 'voice': voice, 'noteIndex': index,
                'measure': int(note['beat']//4)+1, 'beat': note['beat'], 'kind': kind,
                'pitchChanged': pitch, 'startBeat': start_beat, 'endBeat': end_beat,
                'lyric': updated[low]['lyric'] or updated[index]['lyric'] or part['name'],
                'image': crop_pair(document, previous, note)})
        document.close()
    for score in [original, proposed]:
        for voice, part in score['voices'].items():
            part['pdf'] = '/api/finale/pdf/'+voice
    review_hash = hashlib.sha256(json.dumps(proposed, ensure_ascii=False, sort_keys=True).encode('utf8')).hexdigest()
    return {'version': 1, 'kind': 'tie-review', 'reviewHash': review_hash, 'sourceHash': hashlib.sha256(source.read_bytes()).hexdigest(),
        'summary': totals, 'original': original, 'proposed': proposed, 'cases': cases}


if __name__ == '__main__':
    bundle = build_review()
    target = ROOT/'assets/finale-tie-review.json'
    target.write_text(json.dumps(bundle, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
    print(json.dumps({'file': str(target), 'bytes': target.stat().st_size, **bundle['summary']}))
