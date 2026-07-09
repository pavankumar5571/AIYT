# Module 4 — Story Generator

Project root: `C:\AI-Youtube\`

## 1. Objectives

- Generate a unique, kid-safe, ~3-minute story with Gemini on every run.
- Keep the storytelling voice in **editable prompt files**, not buried in workflow nodes.
- Get **structured JSON** back (guaranteed parseable — no fragile text scraping).
- Generate character **visual descriptions** alongside the story (the seed for Module 6's
  character consistency).
- Maintain a **uniqueness log** so daily runs never repeat a story.

Why this design: the story is the root artifact of the whole pipeline — every later
module (scenes, images, narration, SEO) reads the story JSON file. Getting a clean,
validated, machine-readable story file is what makes the rest automatable.

## 2. Folder Structure Changes

```
C:\AI-Youtube\
├── prompts\
│   ├── story-config.json        ← NEW: themes, audience age, target words, model
│   ├── story-system.md          ← NEW: the storytelling voice/safety rules
│   └── story-user-template.md   ← NEW: per-run request with {{PLACEHOLDERS}}
├── output\stories\              ← NEW: one JSON file per generated story
├── logs\story-log.json          ← NEW: uniqueness log (title+theme history)
└── workflows\module-04-story-generator.json
```

Tune the channel's voice by editing the `.md` files — no n8n changes needed.
`story-config.json` controls audience age, word target (420 ≈ 3 min narrated),
theme pool, and which Gemini model is used.

## 3. Docker Configuration Change

n8n sandboxes filesystem access by default (nodes could only touch
`/home/node/.n8n-files`). Added to `docker-compose.yml`:

```yaml
- N8N_RESTRICT_FILE_ACCESS_TO=/data
```

This allows the file nodes to read/write the project bind mounts (and nothing else).
Applied with `docker compose --env-file ..\.env up -d`.

## 4. Workflow Explanation (`aiytM4StoryGen001`)

```
Manual Trigger
 → Read/Extract: config, story log, system prompt, user template   (4 file reads)
 → Build Gemini Request   (Code: pick random theme, inject avoid-list into template,
                           build responseSchema for structured JSON output)
 → Gemini Generate Story  (HTTP POST models/<model>:generateContent, credential
                           "Gemini - AIYT", responseMimeType application/json)
 → Parse and Validate     (Code: JSON.parse, required fields, min word count,
                           duplicate-title check, build id/slug/date)
 → Write Story File       (/data/output/stories/<date>_<slug>.json)
 → Write Story Log        (/data/logs/story-log.json with new entry appended)
 → Summary                (title, word_count, saved_to, characters)
```

Uniqueness works on two levels:
1. **Prompt-side**: the last `avoid_recent` (20) titles+themes are injected into the
   prompt as "must be completely different from these".
2. **Validation-side**: if Gemini still returns an already-used title, the run fails
   loudly instead of publishing a duplicate (Module 16 adds automatic retry).

Story JSON schema: `id, date, generated_at, model, requested_theme, word_count,
status, title, logline, theme, moral, characters[{name, description,
visual_description}], story_text`.

## 5. Terminal Commands

```powershell
# Re-import after editing the workflow JSON
docker exec aiyt_n8n n8n import:workflow --input=/data/workflows/module-04-story-generator.json

# Run headlessly
docker exec -e N8N_RUNNERS_BROKER_PORT=5680 aiyt_n8n n8n execute --id aiytM4StoryGen001

# Inspect results
Get-ChildItem C:\AI-Youtube\output\stories
Get-Content C:\AI-Youtube\logs\story-log.json
```

Or in the UI: open workflow "Module 04 - Story Generator" → Execute Workflow.

## 6. Common Mistakes

- **Editing prompts and expecting old runs to change** — prompts are read fresh on
  every run, but already-generated story files are never rewritten.
- **`extractFromFile (fromJson)` nests output under `json.data`** — Code nodes must
  unwrap (`raw.data ?? raw`). Cost us one debug cycle; now handled defensively.
- **`convertToFile (toJson)` default mode wraps output in an array** — use
  `"mode": "each"` to write a bare object. (First two files were written wrapped
  and manually unwrapped.)
- **Deleting `logs\story-log.json`** — resets uniqueness memory; the generator may
  then repeat old stories. It must exist (minimum content: `{"used": []}`).
- **Free-tier rate limits** — Gemini free tier allows limited requests/minute; if
  a run fails with 429 RESOURCE_EXHAUSTED, wait a minute and re-run.

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Access to the file is not allowed" | `N8N_RESTRICT_FILE_ACCESS_TO` missing | check compose env, `up -d`, retry |
| "Gemini did not return valid JSON" | model output glitch | re-run; schema-forced output makes this rare |
| "Story too short" | model under-delivered | re-run; raise `target_words` tolerance in Parse node if frequent |
| "Duplicate story title generated" | theme pool too small / log very long | add themes to config; raise `avoid_recent` |
| 429 RESOURCE_EXHAUSTED | free-tier rate limit | wait 60s; retry |
| Story file is `[ {...} ]` array | convertToFile mode not "each" | re-import current workflow JSON |

## 8. Validation Checklist

- [x] Prompt files exist and are editable independently of n8n.
- [x] Workflow imports and executes: status `success`.
- [x] Story JSON written to `output\stories\` with all required fields (run 1:
      "Pip and the Giant Raincloud", 4.9 KB).
- [x] Uniqueness log appends per run and is valid JSON (object, not array).
- [x] Second run produces a different story ("Mimi's Slow Ride to the Sweet Plums",
      401 words) with the first title in its avoid-list.
- [x] Character visual descriptions are illustration-ready (specific colors,
      clothing, features).

**MODULE 4 COMPLETE.** Next: **Module 5 (Scene Generator)** — split a story JSON
into timed scenes with per-scene image prompts.
