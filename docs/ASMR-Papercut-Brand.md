# ASMR Papercut Shorts — Brand & Pipeline Spec (Brand A)

Status: **BUILD IN PROGRESS** (started 2026-07-18). Near-term brand from the re-architecture
plan (`~/.claude/plans/lovely-toasting-horizon.md`). Long-format Cocomelon rhymes = Brand B,
designed later, reuses the same asset library + Veo modules.

## What it produces
Vertical **9:16, ≤ 60 s** oddly-satisfying ASMR shorts: a cozy handmade **cut-paper** world
where a subject built from layered construction paper is slowly sliced and rearranged with
crisp gentle paper sounds. **Audio = ASMR sounds only** (paper slice/rustle/settle + soft
ambient bed). No singing, no faces, no on-screen text.

## The reuse mechanism (core requirement: generate once, reuse, reposition)
1. **Asset Library** (`assets/library/{characters,props}/<slug>/canonical.png`) + registry
   (`prompts/asset-registry.json`) is the source of truth. Recurring tools (paper hands, craft
   knife, cutting board) are pinned in `prompts/asmr/idea-config.json` and reused in EVERY
   video; only the subject prop changes per video.
2. **A02 Asset Manager** reconciles a concept's needed assets vs the registry → marks each
   `ready` (reuse) or `missing` (generate).
3. **A03 Asset Generator** generates **only `missing`** assets once (Nano Banana, clean neutral
   bg), saves the canonical PNG, flips the entry to `ready` + records `asset_path`. Existing
   assets are never regenerated.
4. **A06** composes each scene's **start-frame** from the saved canonical PNGs placed at the
   scene's `layout` (same asset, new position), then **Veo image-to-video** animates it.

## Module chain (A-series; reuses existing skeletons)
| # | Module | Skeleton | Prompts/config | Output |
|---|---|---|---|---|
| A01 | Idea/Concept | module-04 | `asmr/idea-system.md`, `asmr/idea-config.json` | `output/asmr/ideas/<id>.json` (+ `ideas/used.json` dedupe) |
| A02 | Asset Manager | module-06 | `prompts/asset-registry.json` | resolved assets on concept |
| A03 | Asset Generator | _retired/module-07 | `asmr/asset-gen-config.json` | `assets/library/<kind>/<slug>/canonical.png`, registry→ready |
| A04 | Storyboard | module-05 | `asmr/storyboard-system.md`, `asmr/storyboard-config.json` | `output/asmr/scenes/<id>.json` |
| A05 | Veo Prompt | module-10a | `asmr/veo-system.md` | `output/asmr/veo/<id>_prompts.json` |
| A06 | Start-frame + Veo | NEW | `asmr/start-frame-system.md`, `asmr/veo-config.json` | `output/asmr/frames/<id>/scene-NN.png`, `clips/<id>/scene-NN.mp4` |
| A07 | ASMR Audio | narrate_worker/ffmpeg | (SFX in `assets/asmr/sfx/`, ambient in `assets/asmr/ambient/`) | `output/asmr/audio/<id>.wav` |
| A09 | Assemble (vertical) | assemble-video.sh | `scripts/asmr/assemble-vertical.sh` | `output/asmr/videos/<id>.mp4` (1080×1920) |
| A10 | Thumbnail | module-11 | (papercraft, 9:16) | `output/asmr/thumbnails/<id>.jpg` |
| A11 | SEO | module-12 | `asmr/seo-*` | `output/asmr/meta/<id>.json` (#Shorts + ASMR tags) |
| A12 | Upload | module-13 | new brand OAuth cred | YouTube Shorts (private first) |

## Concept JSON (A01 → downstream)
```
{ id, title, brand:"asmr_papercut", format:"short",
  subject, subject_slug,
  characters:[{slug,name,kind,visual_description}],   // recurring tools (auto-added)
  props:[{slug,name,kind,visual_description}],         // recurring tools + subject prop(s)
  satisfying_beats:[...], asmr_sounds:[...] }
```
Scene JSON (A04): `{ scenes:[{ scene, duration_seconds, present_assets:[slug], setting,
layout, action, asmr_sound }], total_seconds }` — `total_seconds ≤ 60` enforced in-workflow.

## Duration
`clip_seconds` 8 × `max_scenes` 7 = 56 s ≤ 60 cap. Assemble asserts final ≤ 60 s.

## Open / verify at build
- Exact **Veo model id** + **billing** on project `ai-youtube-generator` (A06 is the paid gate).
- **New brand YouTube channel + OAuth cred** (see `Shorts-Channel-Design.md` §7.1); brand name TBD.
- ASMR SFX must be **royalty-free/CC0** in `assets/asmr/sfx/`.
- n8n gotchas still apply (see `project-status` memory): `N8N_RESTRICT_FILE_ACCESS_TO=/data`,
  `extractFromFile fromJson` nests under `.data`, `convertToFile toJson` needs `mode:each`,
  Convert-to-File wipes `$json`, CLI needs `N8N_RUNNERS_BROKER_PORT`.
```
