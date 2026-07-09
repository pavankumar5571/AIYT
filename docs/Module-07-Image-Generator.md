# Module 7 — Image Generator

Project root: `C:\AI-Youtube\`

## 1. Objectives

- Turn each scene's assembled `image_prompt` into an actual 16:9 illustration.
- Use Gemini's image model **Nano Banana** (`gemini-3.1-flash-image`).
- Save one JPEG per scene + an image manifest, ready for the FFmpeg renderer (M10).
- Keep it cheap and safe: a `max_scenes` cap for cheap test runs, per-image retry.

**This is the first PAID module.** Image generation is not on the Gemini free tier
(`generate_content_free_tier_requests` limit = 0 for the image model). It requires
billing linked to the Google Cloud project. Cost ≈ **$0.03-0.07 per image**, so a
~10-scene video ≈ **$0.30-0.70**. (Covered by Google AI Ultra's monthly Cloud
credits on this account.)

## 2. Folder Structure Changes

```
C:\AI-Youtube\
├── prompts\image-config.json   ← NEW: image model, aspect ratio, max_scenes cap
├── output\images\              ← now holds <story-id>_scene-NN.jpg + <story-id>_images.json
└── workflows\module-07-image-generator.json
```

`image-config.json`:
```json
{
  "image_model": "gemini-3.1-flash-image",  // Nano Banana
  "aspect_ratio": "16:9",
  "output_ext": "jpg",
  "max_scenes": 0        // 0 = all scenes; set e.g. 2 to test cheaply first
}
```

Files are named flat `<story-id>_scene-01.jpg` (the story-id prefix groups them; flat
naming avoids per-run mkdir in n8n).

## 3. Workflow Explanation (`aiytM7ImageGen001`)

```
Manual Trigger
 → Read/Extract image-config
 → Read/Extract story-log → Pick Latest Story → scenes_path
 → Read/Extract scenes file
 → Prepare Scene Items (Code): emit ONE item per scene (up to max_scenes), each with
     the request body {contents:[{parts:[{text: image_prompt}]}],
     generationConfig:{responseModalities:['IMAGE'], imageConfig:{aspectRatio:'16:9'}}}
 → Generate Image (HTTP, runs once PER scene item; Retry On Fail x3)
 → Extract Image B64 (Code: pull inlineData.data per item, paired by index)
 → Base64 to Binary (Convert to File, toBinary, sourceProperty=imageB64)
 → Write Image File (one JPEG per scene)
 → Collect Results → Write Manifest (<story-id>_images.json) → Summary
```

Per-scene iteration: the HTTP node fires once per input item automatically, so 10
scenes = 10 image calls in one execution.

## 4. Key n8n techniques learned (important for later media modules)

- **Convert to File WIPES the JSON** (`json` becomes `{}`, only `binary` remains).
  So downstream nodes must pull metadata (like the output path) from an UPSTREAM node
  via paired items: `={{ $('Extract Image B64').item.json.out_path }}` — NOT `$json`.
  This was the one bug in the first run ("Cannot read properties of undefined
  (reading 'toString')" = the file path was undefined).
- **Base64 → file**: Convert to File node, operation "Move Base64 String to File"
  (`operation: toBinary`, `sourceProperty: <json field with base64>`) → binary lands
  under property `data` → Write (Read/Write File) with `dataPropertyName: data`.
- Binary is stored on disk (filesystem-v2), not in Postgres, because Module 2 set
  `N8N_DEFAULT_BINARY_DATA_MODE=filesystem`.
- Image response path: `candidates[0].content.parts[]` — the image part is the one
  with `inlineData` (may not be parts[0]); find it, don't assume index.
- Lock 16:9 with `generationConfig.imageConfig.aspectRatio: "16:9"` — verified output
  1376x768 JPEG (FFmpeg will scale to 1920x1080 in Module 10).

## 5. Terminal Commands

```powershell
docker exec aiyt_n8n n8n import:workflow --input=/data/workflows/module-07-image-generator.json
# Cheap test first: set max_scenes to 2 in image-config.json, then:
docker exec -e N8N_RUNNERS_BROKER_PORT=5680 aiyt_n8n n8n execute --id aiytM7ImageGen001
# Then set max_scenes to 0 and run again for all scenes.

Get-ChildItem C:\AI-Youtube\output\images\*scene*.jpg
```

## 6. Common Mistakes

- **Running before billing is linked** → HTTP 429 `limit: 0` on the image model.
  Link a billing account to the project (AI Studio → Billing).
- **Expecting `$json` after Convert to File** → it's empty; reference upstream nodes.
- **Leaving `max_scenes` at a small test value** → only a few images get made; set to
  0 for full videos.
- **Assuming style is identical across scenes** — per-scene text-to-image has some
  STYLE DRIFT (see Known Limitations). Characters stay consistent (descriptions are
  injected), but overall rendering style can vary scene to scene.

## 7. Known Limitations (targets for Module 17 - Quality)

- **Style drift** between scenes (one flatter, one more painterly). Fix later by
  feeding Nano Banana a **reference image** (it supports image+text input for
  character/style locking) or generating from a fixed seed/style anchor.
- **No graceful per-scene skip yet** — if one scene's image is blocked by a content
  filter, the run fails at that scene. Module 16 (Error Handling) adds skip+continue
  and a placeholder image.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| HTTP 429 `limit: 0` | billing not linked to project | link billing account in AI Studio |
| "Cannot read ... 'toString'" | used `$json` after Convert to File | reference upstream node's paired item |
| "No image returned for scene N" | content filter or wrong modality | check the scene prompt; re-run (retry x3 handles transients) |
| Only some scenes generated | `max_scenes` cap set | set `max_scenes` to 0 |
| Images not 16:9 | aspectRatio not applied | confirm `imageConfig.aspectRatio` in body |

## 9. Validation Checklist

- [x] Billing verified live (image test returned real JPEG bytes).
- [x] 16:9 confirmed (1376x768 JPEG).
- [x] Cheap 2-scene test succeeded before full run.
- [x] Full run: 10/10 scene images written + manifest `<story-id>_images.json`.
- [x] Character consistency holds across images: Mimi identical in scenes 1 & 6,
      Barnaby identical in scenes 2 & 6 (descriptions injected from character memory).
- [x] Total footprint ~7.6 MB for 10 images (~0.6-0.9 MB each).

**MODULE 7 COMPLETE.** Next: **Module 8 (Narration)** — turn each scene's `narration`
text into AI voice audio (Gemini TTS), timed to the scene durations. Also paid, also
covered by Ultra credits (~$0.05 per 3-min narration).
