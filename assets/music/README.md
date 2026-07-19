# Background music for videos

Drop calming, **royalty-free / properly licensed** instrumental tracks in this folder.
`scripts/assemble-video.sh` automatically picks the **first** audio file here
(`.mp3`, `.wav`, or `.m4a`, alphabetical), loops it to the length of the narration,
mixes it softly under the voice, and fades it in/out.

## How the pipeline uses it
- Volume: soft bed at `MUSIC_VOLUME` (default **0.10** = sleep-friendly). Override per run:
  `MUSIC_VOLUME=0.15 bash /data/scripts/assemble-video.sh <STORY_ID>`
- Fades: 3s fade-in at the start, 6s fade-out at the very end.
- Looping: short tracks are repeated automatically to fill the whole story.
- Selection: it uses the **first** file alphabetically. To force one, name it `00-track.mp3`.

## For SLEEP stories, choose music that is:
- Instrumental only (no lyrics), slow tempo (~50–70 BPM)
- Soft piano, gentle strings, ambient pads, music-box, or lullaby
- No sudden swells, percussion hits, or bright/energetic sections
- Long and loopable (seamless is ideal)

## Where to get it (free & license-safe)
- **YouTube Audio Library** (studio.youtube.com → Audio Library) — filter Genre = *Ambient* /
  Mood = *Calm* / *Sad*, and prefer tracks marked **"No attribution required."** Safest option
  since it's YouTube's own library.
- **Pixabay Music** (pixabay.com/music) — free, no attribution, commercial-OK. Search
  "lullaby", "sleep", "calm piano", "ambient".
- **Chosic.com**, **Free Music Archive**, **Incompetech (Kevin MacLeod)** — free but many
  require **attribution in the description** (check each track's license).

## IMPORTANT — licensing & kids channels
- Read each track's license. If it says *attribution required*, put the required credit line
  in the **video description** (Module 12 SEO output).
- Do NOT use pop songs, movie/TV scores, or anything not explicitly licensed for reuse —
  Content ID will flag it, and repeated claims can take down a kids channel.
- Keep a note of each track's source + license (add a `LICENSES.txt` here) so you can prove it.

## Current status
Folder is empty → videos render with **narration only** (no music) until you add a track here.
