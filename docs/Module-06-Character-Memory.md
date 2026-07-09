# Module 6 — Character Memory

Project root: `C:\AI-Youtube\`

## 1. Objectives

- Give the channel a persistent **character bible** so a named character looks the
  same across *different episodes*, not just within one story.
- Two mechanisms:
  1. **registry** — auto-maintained. Every character ever generated is remembered
     (name → canonical description). If a future story re-uses that name, it inherits
     the original look instead of the model re-inventing it.
  2. **recurring_characters** — manually pinned (e.g. a channel mascot). These
     always override whatever a story generated, so a mascot is byte-identical in
     every episode.

Why this matters: Module 5 already keeps characters consistent *inside* one story.
Module 6 extends that consistency *across* stories — the foundation for recurring
casts, mascots, and series.

## 2. Pipeline position

The pipeline order is now **Module 4 → Module 6 → Module 5**:

```
Module 4 (Story)  →  Module 6 (Character Memory)  →  Module 5 (Scenes)
  generates fresh      reconciles the story's          reads the resolved
  characters           characters against the bible    story, builds prompts
                       (rewrites the story file)        from canonical looks
```

Module 6 rewrites the story's `characters[]` in place with resolved (canonical)
descriptions and adds a `character_memory` record of what it did. Module 5 then
picks up those descriptions automatically.

## 3. Folder Structure Changes

```
C:\AI-Youtube\
├── prompts\character-bible.json   ← NEW: the persistent memory (registry + pins)
└── workflows\module-06-character-memory.json
```

`character-bible.json`:
```json
{
  "art_style_reference": "... channel look, keep in sync with scene-config image_style ...",
  "recurring_characters": {          // manually pinned; always win
    "Boopa": { "description": "...", "visual_description": "...", "locked": true }
  },
  "registry": {                      // auto-grown; one entry per character name
    "mimi": { "name": "Mimi", "description": "...", "visual_description": "...",
              "first_seen": "<story-id>", "last_seen": "<story-id>", "times_seen": 1 }
  }
}
```

## 4. Workflow Explanation (`aiytM6CharMem001`)

```
Manual Trigger
 → Read/Extract story-log → Pick Latest Story
 → Read/Extract that story
 → Read/Extract character-bible
 → Resolve Characters (Code): for each story character (by lowercased name):
       recurring pin?   → replace with pinned canonical look   (action: recurring-locked)
       in registry?     → replace with registry look, times_seen++ (action: registry-match)
       otherwise (new)  → add to registry as-is               (action: new-registered)
 → Write Story File  (story rewritten with resolved characters + character_memory)
 → Write Character Bible  (registry / counters updated)
 → Summary  (per-character action + registry size)
```

Resolution precedence: **recurring pin > registry > new**. Matching is on the
lowercased character name.

## 5. How to pin a recurring character (mascot)

Edit `prompts/character-bible.json`, add an entry under `recurring_characters`:

```json
"recurring_characters": {
  "Boopa": {
    "description": "The cheerful Boopaloo Kids mascot who introduces every story.",
    "visual_description": "A round sky-blue owl with a cream tummy, big friendly orange eyes, tiny round glasses, and a little red bow tie.",
    "locked": true
  }
}
```

From then on, any story that features a character named "Boopa" gets exactly that
look. NOTE: pinning only controls *appearance*. To make the mascot actually appear
in stories, also name it in the Module 4 story prompt (a future enhancement).

## 6. Terminal Commands

```powershell
docker exec aiyt_n8n n8n import:workflow --input=/data/workflows/module-06-character-memory.json
docker exec -e N8N_RUNNERS_BROKER_PORT=5680 aiyt_n8n n8n execute --id aiytM6CharMem001

# then re-run scenes so the resolved looks flow into image prompts
docker exec -e N8N_RUNNERS_BROKER_PORT=5680 aiyt_n8n n8n execute --id aiytM5SceneGen001

Get-Content C:\AI-Youtube\prompts\character-bible.json
```

## 7. Common Mistakes

- **Running Module 5 before Module 6** — scenes would use the un-reconciled story.
  Correct order per video: 4 → 6 → 5.
- **Expecting a pinned character to appear in stories** — pinning fixes *appearance*
  only; the character still has to be written into the story (Module 4 prompt).
- **Editing a description in the story file** — Module 6 will overwrite it on the
  next run if the character is in the registry/pins. Edit the bible instead; the
  bible is the source of truth.
- **Deleting `character-bible.json`** — loses all cross-episode memory. It must exist
  (minimum: `{"recurring_characters":{}, "registry":{}}`).
- **Name spelling drift** — "Mimi" vs "Mimí" are different keys; the model must spell
  a recurring name consistently for the memory to match.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Character look not staying consistent across episodes | name spelled differently each time | pin it in `recurring_characters` |
| Pinned look not applied | name mismatch (case is handled, spelling is not) | match the exact spelling |
| Registry growing with near-duplicate names | model invents slightly different names | pin the canonical name |
| "No stories in story-log.json" | Module 4 not run | run Module 4 first |

## 9. Validation Checklist

- [x] `character-bible.json` created with `recurring_characters` + `registry`.
- [x] Run 1: Mimi + Barnaby `new-registered`; registry size 2 with full descriptions.
- [x] Run 2: same names `registry-match` (times_seen++), registry stays size 2,
      descriptions do not drift — memory works.
- [x] Pinned Mimi with a different look → Run 3: `recurring-locked`, the story's Mimi
      description was overridden to the pinned version (Barnaby untouched).
- [x] Re-ran Module 5: the overridden look propagated into the scene image prompts
      ("GOLDEN acorn backpack" replaced "cherry-red backpack") — memory reaches the
      illustrations.
- [x] Demo pin removed; story restored to original look from the registry; clean
      state (registry preserved, 0 pins, counters reset to 1).

**MODULE 6 COMPLETE.** Next: **Module 7 (Image Generation)** — turn each scene's
`image_prompt` into an actual 16:9 illustration via Gemini's image model
("Nano Banana"). This is the first module that needs **billing enabled** on the
Google Cloud project (~$5), since image generation is not on the free tier.
