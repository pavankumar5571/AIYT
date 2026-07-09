# Zero-Budget Business Strategy — AI YouTube Story Generator

Written: July 2026. Goal stated: reach $400/week and scale, starting from phone + laptop + wifi only (no budget for paid APIs).

## 0. The honest starting point

No automation system — mine or anyone's — can *guarantee* a dollar figure per week. Revenue on YouTube is a function of **views × RPM**, and views depend on niche, hook quality, consistency, and the algorithm, none of which are fully controllable. What automation *can* do is remove the two real bottlenecks for a solo person with no budget: the cash cost of production, and the time cost of production. That's what this plan optimizes for. Treat every timeline below as a floor, not a promise — some channels beat these numbers, most take longer.

The math, worked backwards: faceless story/narration channels typically run **$2–$4 RPM** (revenue per 1,000 views, after YouTube's cut) — finance/business content runs far higher ($15–$40 CPM) but is much harder to produce as "stories." At a $3 RPM, $400/week needs roughly **130,000–140,000 views/week**. That's not a first-week number for a brand new channel — it's what a channel with a working format and a real subscriber base can put up once it's found traction. Getting there is Phase 2 below, not Phase 0.

## 1. Rebuilding the tech stack at $0

Your original plan used OpenAI (paid) for story/SEO text, TTS, and (optionally) an image API. All of that gets replaced with free tiers or self-hosted alternatives. This changes Modules 3, 4, 7, 8, and 12 from the original roadmap — everything else (n8n, PostgreSQL, FFmpeg, YouTube API) was already free.

| Pipeline stage | Original plan | Zero-budget replacement | Notes |
|---|---|---|---|
| Story + scene text + SEO metadata | OpenAI API (paid) | **Groq** (free tier: ~30 req/min, 1,000 req/day, Llama/Kimi models) or **Google AI Studio / Gemini** free tier | Groq is fast and generous enough for 1 video/day easily. Gemini is a solid fallback/second option. |
| Narration (TTS) | OpenAI TTS (paid) | **Microsoft Edge neural voices via the unofficial `edge-tts` library** (free, very natural-sounding) | This rides on Microsoft's Read Aloud feature via an unofficial open-source wrapper, not an official commercial API — free and widely used by hobbyists, but there's no formal commercial license backing it. Worth knowing that risk exists before scaling revenue on top of it; Azure/Google Cloud TTS official free-tier quotas are the "safer" fallback if that ever becomes a concern. |
| Images | Paid image API / later ComfyUI | **Self-hosted Stable Diffusion / FLUX.1 [schnell]** via ComfyUI (free, runs locally), or a free hosted option like **Cloudflare Workers AI** (10,000 free "neurons"/day) | Your laptop's GPU matters a lot here — see the note below. |
| Video render | FFmpeg | FFmpeg | Already free, no change. |
| Automation / DB | n8n + PostgreSQL, self-hosted | Same | Already free, no change. |
| Upload | YouTube Data API v3 | Same | Free, just quota-limited (see Module 13 later). |

**On images specifically:** local Stable Diffusion/FLUX generation needs a decent GPU to be fast enough for daily production. If `Get-CimInstance Win32_VideoController` (which I asked for earlier) shows integrated AMD graphics only, self-hosted generation will be slow — usable, just not fast. In that case, lean on a free hosted tier (Cloudflare Workers AI, or a free-tier image API) for now, and revisit local generation if you ever add a GPU.

## 2. Phased roadmap

**Phase 0 — Build (now → ~2 weeks).** Finish the technical build (Modules 1–13) using the $0 stack above. Output: a working pipeline that produces a finished MP4 + thumbnail + metadata with zero per-video cash cost. Zero revenue in this phase — this is infrastructure.

**Phase 1 — Prove the format (weeks 2–10).** Pick one niche (see below) and publish consistently — daily is ideal, since that's what the automation is for. No monetization is possible yet in most cases; **YouTube Partner Program requires 1,000 subscribers + 4,000 public watch hours in 12 months (long-form), or 1,000 subscribers + 10 million Shorts views in 90 days** ([YouTube Partner Program eligibility](https://support.google.com/youtube/answer/72851)). This phase is about hitting that bar, and about learning — which thumbnails get clicks, which hooks hold retention, which topics within your niche perform. Track this weekly; it's the actual leading indicator of future revenue, more than subscriber count alone.

**Phase 2 — Monetize (once YPP-eligible).** Apply for YPP, link AdSense, turn ads on. In parallel — and this can start on day one, no YPP needed — add **affiliate links** in every video description relevant to your niche (Amazon Associates for props/books mentioned in stories, etc.). Affiliate income is usually the first real dollars for a new channel, before ad revenue becomes meaningful, because it doesn't require any subscriber threshold.

**Phase 3 — Scale to $400/week and beyond.** Once you have a format that reliably gets views, scaling is about volume and distribution, not reinventing the pipeline: increase upload frequency, repurpose each story into 3-5 Shorts (different platform, different algorithm, free extra distribution), and — the highest-leverage move once Module 1-13 works reliably — clone the pipeline onto a second channel in an adjacent niche. Two channels each doing half the views of one isn't identical economics (fixed costs like your time and compute are shared), so this is usually a better scaling move than trying to 3x one channel's output.

## 3. Niche selection under these constraints

Given zero budget and a preference for automation-friendly "story" content, the practical options are things like: Reddit-story narration, mythology/folklore retellings, true crime narration, horror shorts, historical "what if" narratives, or motivational/parable-style stories. These are proven faceless-channel formats specifically because they don't need a face, a studio, or expensive footage — just narration over generated visuals, which is exactly what this pipeline produces.

RPM for pure entertainment/story content sits at the lower end of the market ($2–$4 range is typical) versus finance/business content ($15–$40 CPM) — but finance content is much harder to turn into a "story" format and usually needs a real presenter or genuine expertise to not feel hollow. Given the goal is automation-first, staying in the story lane and compensating with volume/consistency is the more realistic path than chasing high-CPM niches that don't fit the format.

## 4. What this changes about the module plan going forward

- **Module 3** (credentials): add Groq / Google AI Studio credentials instead of (or alongside) OpenAI.
- **Module 4 & 12** (story generation, SEO metadata): prompts get adapted for Groq/Gemini's models — the logic is the same, just a different API node in n8n.
- **Module 7** (images): decide self-hosted ComfyUI vs. free hosted API based on your GPU check.
- **Module 8** (narration): swap in `edge-tts` (likely via an n8n Execute Command node calling a small Python/Node script, since it isn't a hosted HTTP API n8n can call directly).
- Everything else (scenes, character memory, subtitles, FFmpeg render, thumbnail, upload, scheduler, logging, error handling) is unchanged — those were never tied to a paid API in the first place.

We'll wire each of these in when we reach that module, in order, same as the original plan.

## Sources

- [YouTube Partner Program overview & eligibility](https://support.google.com/youtube/answer/72851)
- [Free LLM API 2026: 13 Options Ranked and Compared](https://openrouter.ai/blog/tutorials/free-llm-apis-compared/)
- [Top Free Text-to-Speech Tools, APIs, and Open-Source Models](https://www.edenai.co/post/top-free-text-to-speech-tools-apis-and-open-source-models)
- [Top Free Image Generation Tools, APIs, and Open-Source Models](https://www.edenai.co/post/top-free-image-generation-tools-apis-and-open-source-models)
- [YouTube CPM and RPM rates in 2026: averages by niche, country & more](https://milx.app/en/trends/youtube-cpm-rpm-rates-2026-average-niches-countries-more)
