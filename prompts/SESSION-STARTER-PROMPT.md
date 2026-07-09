# Session Starter Prompt — AI YouTube Story Generator

Copy everything between the lines into a NEW chat whenever you continue the project.
Fill in the two placeholders marked with [ ].

---

## PROJECT CONTEXT (compressed — do not re-explain any of this back to me)

I'm building an automated AI YouTube Story Generator on Windows (HP ENVY x360, Ryzen 7 5000, integrated GPU unless I say otherwise), zero budget. You are my technical mentor. Stack, already decided — do not revisit:

- n8n Community Edition + PostgreSQL 16 via Docker Compose (running; project root C:\AI-Youtube\, compose in docker\, .env at root, bind mounts map C:\AI-Youtube\{output,assets,prompts,workflows,logs} to /data/... in the n8n container)
- LLM: Groq free tier (fallback: Google AI Studio/Gemini free tier) — story, scenes, SEO
- TTS: edge-tts (free, unofficial MS Edge voices)
- Images: free hosted API (Cloudflare Workers AI) unless I confirm a dedicated GPU, then local ComfyUI
- Video: FFmpeg, 1920x1080@30fps master + 1080x1920 vertical cut, burned subtitles, Ken Burns motion, royalty-free music from assets\
- Upload: YouTube Data API v3 (OAuth). Later: TikTok/Reels staging folder
- Logging: PostgreSQL table, one row per video per platform
- 18-module plan; docs for each module live in C:\AI-Youtube\docs\

## CURRENT STATE

- Completed modules: [ e.g. "1 and 2 — stack runs, n8n reachable at localhost:5678" ]
- Now working on: Module [ number + one-line goal ]

## WORKING RULES FOR THIS SESSION (token efficiency)

1. No recaps, no restating the project, no motivational filler. Assume I remember everything above.
2. One module (or one step of it) at a time. Wait for my "done" before the next step.
3. Give: exact PowerShell commands, exact file contents (full file only if new; minimal diff if editing), exact n8n node settings as a terse list. Skip theory unless I ask "why".
4. If a file is long, write it to my connected C:\AI-Youtube folder instead of printing it in chat.
5. When I paste an error, respond with the fix only — no explanation of what the error means unless I ask.
6. Keep answers short by default. I will ask when I want depth.

Start now: give me the first step of the module named above.

---

## Tips for keeping token use low (read once, not part of the prompt)

- One module per chat session. Fresh session = small context = cheaper turns and no limit creep. This starter prompt replaces the whole history.
- Never re-paste big files or old messages back into chat. Say "read docs\Module-05.md in my folder" or paste only the 5 relevant lines / the exact error text.
- Batch small questions into one message instead of many one-liners — each turn re-reads the whole conversation.
- Ask for diffs, not full re-prints, when a file needs a small change.
- Keep long reference docs in C:\AI-Youtube\docs\ and have Claude read/write them there rather than flowing through chat.
- If a session gets long and slow, ask: "Summarize state in 5 lines for my next session starter", then start fresh with that pasted into CURRENT STATE.
