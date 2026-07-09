# Module 8 — Narration (Text-to-Speech)

Project root: `C:\AI-Youtube\`

## 1. Objectives

- Turn each scene's `narration` text into AI voice audio with Gemini TTS.
- Produce one WAV clip per scene + an audio manifest with **real, measured durations**.
- Those measured durations become the **source of truth for the video timeline**
  (Module 10 times each image to its narration clip, not to word-count estimates).

Paid (covered by Ultra credits): Gemini TTS ≈ **$0.05 for a full ~3-min narration** —
much cheaper than images.

## 2. The core technical challenge: Gemini TTS returns RAW PCM

Gemini TTS does not return an MP3/WAV. It returns **raw signed 16-bit little-endian
PCM, mono, 24 kHz** (mimeType `audio/L16;codec=pcm;rate=24000`), base64-encoded.
Nothing can play that directly. The workflow wraps it into a WAV by prepending a
44-byte WAV header (built in a Code node with `Buffer`), then writes the `.wav`.

WAV header fields (mono/24k/16-bit): RIFF / (36+dataLen) / WAVE / fmt / 16 / 1 /
channels=1 / rate=24000 / byteRate=48000 / blockAlign=2 / bits=16 / data / dataLen.
Duration is computed exactly: `pcmBytes / (rate * channels * bytesPerSample)`.

## 3. Folder Structure Changes

```
C:\AI-Youtube\
├── prompts\tts-config.json     ← NEW: voice, style directive, model, max_scenes
├── output\audio\               ← <story-id>_scene-NN.wav + <story-id>_audio.json
└── workflows\module-08-narration.json
```

`tts-config.json`:
```json
{
  "tts_model": "gemini-2.5-flash-preview-tts",
  "voice_name": "Kore",   // warm storyteller; swap for another prebuilt voice
  "style_prompt": "Read this aloud in a warm, gentle, expressive storyteller voice for young children:",
  "sample_rate": 24000,
  "output_ext": "wav",
  "max_scenes": 0          // 0 = all; set small to test cheaply
}
```

**Voices** (prebuilt): Kore, Puck, Aoede, Leda, Charon, Fenrir, Orus, Zephyr, and
~20 more. The `style_prompt` is a natural-language directive Gemini follows for tone
— it is NOT read aloud (verified: the instruction adds no spoken words).

## 4. Workflow Explanation (`aiytM8Narration01`)

```
Manual Trigger
 → Read/Extract tts-config
 → Read/Extract story-log → Pick Latest Story → scenes_path
 → Read/Extract scenes
 → Prepare TTS Items (Code): one item per scene; body =
     {contents:[{parts:[{text: style_prompt + narration}]}],
      generationConfig:{responseModalities:['AUDIO'],
        speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName}}}}}
 → Generate Speech (HTTP per scene; Retry On Fail x3)
 → PCM to WAV (Code): per scene, wrap PCM into WAV (Buffer), compute exact duration
 → Base64 to Binary (Convert to File, toBinary, sourceProperty=wavB64)
 → Write Audio File (one WAV per scene)
 → Collect Results → Write Manifest (<story-id>_audio.json) → Summary
```

`Buffer` IS available in the n8n Code node (task runner) — confirmed working. The
same "Convert to File wipes json" rule from Module 7 applies: the Write node pulls
its path from `$('PCM to WAV').item.json.out_path`, not `$json`.

## 5. Real durations vs estimates (important)

The word-count estimate in Module 5 assumed 2.3 words/sec. The actual Kore narration
runs ~2.0 words/sec, so the measured total (200.3s) was longer than the estimate
(174s). Two consequences:
- `scene-config.json` `narration_wps` was tuned 2.3 → 2.0 so future *estimates* are
  closer. (Estimates are only for planning; Module 10 uses the measured audio.)
- **Module 10 must use `output/audio/<id>_audio.json` clip durations** for the
  timeline — each scene image shows for exactly its narration clip length.

## 6. Terminal Commands

```powershell
docker exec aiyt_n8n n8n import:workflow --input=/data/workflows/module-08-narration.json
# cheap test: set max_scenes to 1 in tts-config.json, run, then set 0 for all
docker exec -e N8N_RUNNERS_BROKER_PORT=5680 aiyt_n8n n8n execute --id aiytM8Narration01

Get-ChildItem C:\AI-Youtube\output\audio\*scene*.wav
```

## 7. Common Mistakes

- **Playing the raw API output** — it's PCM, not WAV; must be wrapped (the workflow
  does this).
- **Assuming `responseModalities: ['AUDIO']`** — required; without it you get text.
- **Expecting `$json` after Convert to File** — empty; reference upstream node.
- **Using estimated durations for the final video** — use the measured manifest.
- **Changing `voice_name` to an invalid name** — returns 400; use a listed prebuilt.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 400 invalid voice | typo in `voice_name` | use a valid prebuilt voice |
| Audio won't play / static | PCM not wrapped, or wrong rate in header | ensure header rate matches mimeType `rate=` |
| "No audio for scene N" | modality not set / filter | confirm `responseModalities:['AUDIO']`; retry x3 handles transients |
| Narration reads the style directive aloud | rare | shorten/rephrase `style_prompt` |
| Clip durations all 0 | wrong bytesPerSample math | header uses 16-bit mono; keep bps=16, ch=1 |

## 9. Validation Checklist

- [x] TTS format confirmed: `audio/L16;codec=pcm;rate=24000` (raw PCM).
- [x] WAV wrapping validated on host (SoundPlayer loads it) AND in n8n (Buffer works).
- [x] 1-scene cheap test produced a valid WAV before full run.
- [x] Full run: 10/10 scene WAVs + manifest `<story-id>_audio.json`.
- [x] Manifest carries **measured** per-scene durations; total 200.3s (~3.3 min).
- [x] `narration_wps` tuned to 2.0 to match observed speaking rate.
- [x] Total audio ~9.2 MB across 10 clips.

**MODULE 8 COMPLETE.** Next: **Module 9 (Subtitle Generation)** — produce burned-in
subtitle timing (.srt/.ass) from each scene's narration text and its measured audio
duration, so captions sync to the voice.
