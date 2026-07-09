# Module 3 — API Credentials: Google Gemini + YouTube Data API v3

Project root: `C:\AI-Youtube\`

## 1. Objectives

- Choose the AI provider (decision: **Google Gemini API** — free-tier text, one Google account for AI + YouTube).
- Store all API credentials in `.env` (source of truth for restore).
- Create credentials inside n8n (encrypted in Postgres with the Module 2 key).
- Complete the Google OAuth consent flow so n8n holds live YouTube tokens.
- Prove both APIs work *through n8n itself* with a smoke-test workflow.

## 2. Provider decision (recorded 2026-07-08)

**Primary AI provider: Google Gemini API** (key from aistudio.google.com, attached to
Google Cloud project `ai-youtube-generator`).

| Pipeline step | Model | Cost |
|---|---|---|
| Story / scenes / prompts / SEO | `gemini-3.5-flash` (or `gemini-flash-latest`) | FREE tier (~1,500 req/day) |
| Image generation (Module 7) | `gemini-3.1-flash-image` ("Nano Banana") | ~$0.03-0.07/image — requires enabling billing later |
| Narration TTS (Module 8) | `gemini-2.5-flash-preview-tts` family | ~$0.05 per 3-min narration |
| Subtitle timing (Module 9) | Gemini audio transcription | cheap/free |
| Background music (Module 8, option) | `lyria-3-clip-preview` | TBD |
| Upload | YouTube Data API v3 (OAuth) | free quota, 10,000 units/day |

Rejected alternatives: OpenAI (works, but no free tier; account has no credit —
credential `OpenAI - AIYT` remains in n8n as a dormant fallback), Anthropic Claude
(text-only: no image/TTS APIs), Google Flow/Veo video generation (no API for Flow;
Veo costs $18-72 per 3-min video — prohibitive).

**Billing note:** the Gemini key currently has NO billing attached — text models work
free; image/TTS calls will fail until billing is enabled (~$5 prepaid) at Module 7.

## 3. Folder Structure Changes

```
C:\AI-Youtube\
└── workflows\module-03-smoke-test.json   ← importable smoke-test workflow
```

`.env` holds: `GEMINI_API_KEY`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`,
`OPENAI_API_KEY` (dormant).

## 4. How the credentials were created (repeatable on any machine)

Credentials were imported via n8n's CLI (temp file deleted immediately after):

```powershell
# creds.json format: [{"id","name","type","data":{...plaintext fields...}}]
docker exec aiyt_n8n n8n import:credentials --input=/data/workflows/creds.json
```

Credential names used by ALL later workflows (do not rename):

| n8n credential | type | id | status |
|---|---|---|---|
| **`Gemini - AIYT`** | `googlePalmApi` | `aiytGeminiCred001` | ✅ active (primary) |
| **`YouTube - AIYT`** | `youTubeOAuth2Api` | `aiytYouTubeCred01` | ✅ connected |
| `OpenAI - AIYT` | `openAiApi` | `aiytOpenAiCred001` | dormant (no credit) |

The `googlePalmApi` credential data is `{host: "https://generativelanguage.googleapis.com", apiKey}`.

The YouTube OAuth dance (Sign in with Google) must be done in the n8n UI by the
channel owner — it cannot be scripted. After it succeeds, the credential's encrypted
blob in Postgres grows (~216 B -> ~1.5 KB) because it now holds tokens.

## 5. Google Cloud setup (summary of what exists)

- Project: `ai-youtube-generator`
- Enabled API: **YouTube Data API v3**; Gemini key attached to the same project
- OAuth consent screen: External, status **Testing**, owner gmail as test user
- OAuth client (Web application) redirect URI — must match exactly:
  `http://localhost:5678/rest/oauth2-credential/callback`

While the consent screen stays in **Testing** mode, Google expires the YouTube
refresh token after 7 days — re-connect via "Sign in with Google" weekly. Before
Module 13 (auto-upload), publish the consent screen to "In production" so tokens
stop expiring. (The Gemini API key is NOT affected — API keys don't expire.)

## 6. Smoke-test workflow

`workflows\module-03-smoke-test.json` — chain: Manual Trigger -> YouTube Test
(GET /youtube/v3/channels?mine=true) -> Gemini Test (POST
models/gemini-3.5-flash:generateContent) -> Summarize Result. Both API nodes use
HTTP Request with "predefined credential type" — exactly how later modules authenticate.

Run it headlessly (the CLI needs its own task-broker port because the live
instance holds 5679):

```powershell
docker exec aiyt_n8n n8n import:workflow --input=/data/workflows/module-03-smoke-test.json
docker exec -e N8N_RUNNERS_BROKER_PORT=5680 aiyt_n8n n8n execute --id aiytM3SmokeTest01
```

## 7. Results (2026-07-08)

- **YouTube**: SUCCESS — returned channel "Boopaloo Kids" with live statistics.
- **Gemini**: SUCCESS — `gemini-3.5-flash` replied `GEMINI-OK` through n8n, free tier.
- Overall workflow status: `success`.

## 8. Common Mistakes

- **Renaming the n8n credentials** — every later workflow references them by id/name.
- **Assuming the Gemini key can generate images/TTS now** — it can't until billing
  is enabled on the Google Cloud project (planned for Module 7).
- **Wrong model names** — Gemini model ids shift (e.g. `gemini-3.5-flash`,
  `gemini-3.1-flash-image`). List current ones:
  `Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models" -Headers @{"x-goog-api-key"=$env:GEMINI_API_KEY}`
- **Redirect URI typos** — Google matches character-for-character.
- **Skipping the Test-users step** — causes `Error 403: access_denied` at sign-in.
- **Leaving consent screen in Testing forever** — weekly YouTube token expiry will
  silently break daily automation.

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Gemini node: 429 `RESOURCE_EXHAUSTED` | free-tier rate limit (RPM or daily) | wait / add billing / use `gemini-flash-lite-latest` |
| Gemini node: 400 `API_KEY_INVALID` | key revoked/rotated | update `.env` AND the n8n credential |
| Gemini image/TTS call: 403/429 billing error | no billing on project | enable billing + ~$5 prepaid (Module 7) |
| YouTube node: 401 `invalid_grant` | refresh token expired (Testing mode, 7 days) | open credential -> Sign in with Google again |
| YouTube node: 403 `quotaExceeded` | daily 10,000-unit API quota used | wait until midnight Pacific; uploads cost 1600 units each |
| CLI execute: "port 5679 in use" | live instance owns task-broker port | add `-e N8N_RUNNERS_BROKER_PORT=5680` to `docker exec` |

## 10. Validation Checklist

- [x] `GEMINI_API_KEY`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` in `.env`.
- [x] n8n credentials exist: `Gemini - AIYT`, `YouTube - AIYT` (+ dormant OpenAI).
- [x] YouTube OAuth connected (token blob present, verified in DB).
- [x] Gemini key valid — 50 models visible incl. text, image, TTS, music.
- [x] Smoke test through n8n: YouTube channel data + `GEMINI-OK`, status `success`.

**MODULE 3 COMPLETE.** Next: **Module 4 (Story Generator)**.
