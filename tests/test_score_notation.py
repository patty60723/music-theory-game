"""Retained score matches PDF rhythms and pitch extraction without MP3 tools."""
import json
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from finale_notation import notation_events,read_score,VOICES

class ScoreTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=json.loads((ROOT/'assets/finale-score.json').read_text(encoding='utf-8'))
        cls.events=notation_events(cls.data)

    def test_scores_have_complete_rhythm(self):
        for voice,suffix in VOICES.items():
            measures=read_score(next((ROOT/'assets').glob('*-'+suffix+'.pdf')))
            self.assertEqual(sum(m['beats'] for m in measures),260)
            for measure in measures:self.assertAlmostEqual(measure.get('total',measure['beats']),measure['beats'],places=5)
            for event,published in zip(self.events[voice],self.data['voices'][voice]['notes']):
                self.assertEqual(event['midi'],published['midi'])
                self.assertAlmostEqual(event['beat'],published['beat'],places=5)
                self.assertAlmostEqual(event['endBeat'],published['endBeat'],places=5)

    def test_triplets_and_multi_measure_rest(self):
        notes=self.events['f1'];triplet=[n for n in notes if 54<=n['beat']<56]
        self.assertEqual(len(triplet),3)
        for n in triplet:self.assertAlmostEqual(n['endBeat']-n['beat'],2/3,places=5)
        self.assertFalse(any(160<=n['beat']<168 for n in notes))

if __name__=='__main__':unittest.main()
