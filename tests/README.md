# Four-part piano practice verification

Run (a local Worker HTTP adapter starts automatically):

```
node tests/finale-player.test.cjs
```

The test uses Playwright and installed Microsoft Edge. Set
`CATSHARK_PLAYWRIGHT` if the module is installed outside the project.

Verified in a real headless browser at desktop and 390px mobile widths:

- Playback uses score data and embedded piano with zero MP3 requests.
- Four first attacks use a shared timestamp and correct score pitches.
- Actual left/right analyser outputs follow mute and routing independently.
- Selecting a singing part and swapping assigns all four channels correctly,
  preserving the chosen split direction on subsequent selections.
- The master slider silences and restores the actual audio output. The piano
  roll shows proportional tied-note lengths, note names and empty rest gaps.
- Full lyrics expand/collapse, follow part selection, mark the active phrase
  and seek correctly when a phrase is selected.
- BPM changes scheduling duration while sample playback rates / oscillator
  frequencies remain unchanged for the same notes.
- Ties merge into one audio event. Note counts, tempo-map boundaries and
  malformed-data rejection are also checked.
- Computer-key chords, focused-button Enter/Space, pointer hold/release and
  two simultaneous native touch contacts play and release correctly.
- Lyrics contain joined syllables, active-word progress and selectable parts;
  muting the selected singing part retains its lyrics.
- Layout order is lyrics → piano → controls, without mobile page overflow.
- Score loading failures expose retry; the independent live piano still works.
- Server login/logout works; protected score/PDFs never enter offline caches.
- Offline reload retains the public shell and keeps the practice room locked.
- Existing tab navigation remains functional.

Run syntax checks with `node --check` for the three runtime JS files; the
inline app script is also extracted and checked during development.
`git diff --check` passes. The strict skill audit is saved under ignored
`tmp/verification/ui-audit.json`. Its inline-handler-only scanner flags
JavaScript-bound buttons in the existing app and this screen. Those findings
are not described as a passing audit; real handlers are exercised above.

`node --test tests/worker.test.mjs` checks authentication, protected URLs,
Cookie tampering/expiry, password rotation, request origin, login throttling,
and input bounds against the same Worker code. Build assets first with
`node scripts/build-worker.mjs`.

`python -m unittest discover -s tests -p test_score_notation.py` checks the
retained PDF notation parser and score with PyMuPDF. The score can be rebuilt
with `python scripts/build-finale-score.py`; no MP3 or old alignment draft
is needed.
