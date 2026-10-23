# Four-part piano singing practice

The practice room plays `assets/finale-score.json`. The same score events
drive piano sound, keyboard highlights and karaoke lyrics, so MP3 alignment
and manual timing review are no longer part of this screen. Unused MP3s,
alignment drafts, preview images and retired alignment tools were removed.

## Musical data

The score contains 1,074 written noteheads across four parts and 260 quarter
beats, including rests. Tempo directions are quarter=120 at beat 0, 126 at
beat 96 and 132 at beat 144. Pitches and rhythm are read from PDF vectors;
cached lyric coordinates are retained in the current score JSON. MIDI/audio
alignment timestamps and confidence values are not copied into the piano
score. A PDF extraction can still contain a notation or lyric error; shared
data guarantees consistent playback/display, not a perfect transcription.

Build with Python and PyMuPDF:

```
python scripts/build-finale-score.py
```

`scripts/finale_notation.py` owns the shared vector parser. It handles flags,
beams, dots, rests, triplets, multi-measure rests and the score's key changes.
The build needs no audio decoder or legacy draft file. Keep the current
score JSON as the lyric-coordinate source when rebuilding from the PDFs.

`FinaleScore.prepare` validates the beat-domain score, converts it through
the tempo map, and merges tied continuations into a single sound event while
retaining written noteheads for visual display. At a starting BPM of 120,
the full score including its final rest lasts about 123.58 seconds.

## Playback and keyboard

The shared `pianoNote` uses embedded piano samples, with a harmonic synthesis
fallback, and accepts an optional destination plus a cancellable note handle.
Other app tools keep their existing destination. A short lookahead scheduler
uses one AudioContext clock for all four parts. Pause/seek/tempo changes
cancel pending notes, including future scheduled attacks. Changing BPM
rescales event times and durations without changing note frequency.

The BPM control is the starting tempo, bounded to 40–200 BPM. Written tempo
changes retain their proportions; the current effective BPM is displayed.
Tap tempo and ±1/±5 buttons supplement direct entry and the range slider.

The practice-room metronome is optional and defaults off. It uses the same
score clock and tempo map as the notes, with an accented first beat in 4/4,
a four-beat indicator and an independent click-volume slider. It sounds in
both channels, independently of voice mute/routing, and follows the master
volume. Pause, stop, seek, tempo changes, tab changes and disabling the click
cancel queued clicks; resuming or enabling it joins the next written beat.

Each part routes its mono piano sound independently to left/right gains.
Muting preserves its routing and volume. A compressor handles combined
polyphony. Live keyboard notes have their own path and can be played over
the score. The selected singing part remains visible when muted, using
hollow keys as a pitch guide.

`makePiano(..., {interactive:true})` creates native buttons with pointer
capture, multi-touch note-off, Enter/Space support and roving arrow-key
focus. The computer mapping A W S E D F T G Y H U J K O L P ; spans 17
chromatic notes from C4, with octave controls. Multiple inputs holding the
same pitch share that live note until all release. Blur, backgrounding or
leaving the tab clears manual holds; backgrounding/leaving also pauses the
score. Other app pianos retain the original pointer behavior.

## Karaoke layout

The fixed content order is lyrics, playable piano, main controls, then part
mixing. Lyrics use the selected singing part regardless of its audio mute.
They are grouped into phrases using punctuation, musical gaps and length,
joining split syllables such as com/in’, be/fore and want/ing. Ties and
melismas extend a syllable instead of repeating it. Each phrase renders
once; only its active-word progress changes on the playback clock. The
previous/next phrase supplies context. Reduced motion uses a solid active
word and underline in place of the wipe.

The player fetches no MP3s. Public code and embedded samples support offline
use in the other music tools. This practice room requires Worker login;
score and PDFs use authenticated, uncached API requests. See
[Cloudflare deployment](cloudflare-worker.md).

## Singing cues and stereo focus

The lyric panel has a horizontal piano roll for the selected singing part.
Each bar shows only its note name; horizontal length represents quarter-beat
duration, and vertical position represents pitch. Tied notes form one long
bar. Rests are empty gaps. The score clock moves notes past a fixed playhead;
reduced motion uses a paged track. Pause, seek, BPM and part selection all
update this same timeline. No rest or beat-count labels are shown.

The full-lyrics button expands/collapses the selected part's phrase list.
The current phrase is marked and each row can seek to that phrase's start.
The list has independent scrolling so reading it does not move the controls.
While playing, the current phrase is brought to the middle of this list on
phrase changes, resume or expansion. Only the list scrolls; the document
stays in place. Reduced-motion mode uses an immediate scroll. While paused,
the list remains available for manual reading without automatic scrolling.

Selecting a singing part sends it left and all other parts right. Swap
reverses this split and keeps that orientation for subsequent selections.
Mute and part volumes are preserved. Manual routing remains available;
selecting a part or swapping reapplies the split.

The mix gain is 1.0 ahead of the compressor, followed by 3× makeup gain.
A master slider (0–150%, initially 100%) controls both score playback and
the live piano. A final compressor with a −2 dB threshold and 20:1 ratio
limits combined peaks after the master control; part levels remain separate.

The lyric panel shows the current and next phrase, with compact line spacing.
Landscape screens up to 600px high use a 100px piano roll; resizing rebuilds
the pitch lanes. The top play/pause button shares state with the console.

Male parts default to one octave below the written treble staff for practice.
The PDFs do not explicitly mark an octave transposition. Each part has an
original/lower-octave selector, applied consistently to audio, note names,
the piano roll and lit keys. The manually playable piano keeps its own pitch.

Each part groups Mute, SOLO (only this part) and Only mute this part
(all other parts unmuted). SOLO and Only mute this part apply a complete
four-part mute configuration; pressing an already active preset unmutes all.
Pressed states are derived from the actual mute set, including manual edits.
These actions preserve part volumes, routing and playback position.

Return to original tempo resets the initial BPM to 120 (rate 1), preserving
the score's later tempo changes and the current position/playback state.
It stays in the compact BPM row, including on phones. Three small tabs in
the console switch playback (BPM/metronome), other settings (singing part,
stereo swap, tempo slider, tap tempo/master volume) and manual keyboard.
Transport and seek stay visible across tabs; all four mixer cards follow.
Tab changes keep playback and control values, and support arrows/Home/End.

Playback automatically pans the piano viewport to active pitches and nearby
upcoming notes. When all parts fit, they remain visible together; otherwise
the selected singing part has priority. A held manual key suspends following.
Automatic panning neither scrolls the document nor triggers piano notes.

On touch devices all practice sliders require a horizontal drag beyond
10px before adjusting. Taps and vertical gestures do not change values;
vertical scrolling and pinch zoom remain native. Mouse/keyboard controls
retain native range behavior. The top menu hides on downward page scrolling
and returns on upward scrolling, page top or keyboard focus.

Automatic count-in defaults on and is independent of the optional ongoing
metronome. Only the beginning or an explicitly selected lyric phrase is a
known start; the selected part must also have an onset there. A known start
on beat one gets four preparation beats, on beat three gets two, and on
beat four-and gets 3.5. Fractional beat offsets are preserved. Dragging seek
or resuming after actual song playback starts immediately without count-in.
Its clicks share the metronome volume and
master controls. The first beat is accented. The interval is computed from
the tempo at the selected score position, scaled by the current BPM setting.
The score audio origin follows the calculated number of beat intervals.
During this interval the score clock stays at the selected position,
lyrics and roll stay still, and score key/word highlights remain off.
Normal playback starts audio and highlights from the same clock origin.
Pause/stop/logout cancel future notes and count clicks. Beginning/phrase
starts and loops can count in; normal tempo/register edits add no delay.
Pausing before the count finishes preserves the known start for another try.
Tempo/register edits during count-in restart it; a dragged seek cancels it.
Turning
off count-in while counting starts the score immediately from that position.
