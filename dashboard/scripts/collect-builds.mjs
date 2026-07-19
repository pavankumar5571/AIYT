#!/usr/bin/env node
/**
 * collect-builds.mjs — scans the AI-YouTube pipeline output and writes
 * data/builds.json (the dashboard's data source).
 *
 * Run locally (host has the files):
 *   AIYT_OUTPUT=../output AIYT_LOGS=../logs node scripts/collect-builds.mjs
 * or just `npm run collect` from the dashboard dir (defaults to ../output, ../logs).
 *
 * Vercel never runs this — it renders the committed data/builds.json.
 * To refresh the live dashboard: run this, then git commit + push.
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.env.AIYT_OUTPUT || path.resolve(process.cwd(), '..', 'output');
const LOGS = process.env.AIYT_LOGS || path.resolve(process.cwd(), '..', 'logs');
const DATA_DIR = path.resolve(process.cwd(), 'data');

// --- pricing (estimates, for the "equivalent on paid APIs" figure only) ---
const PRICING = {
  gemini_text_in_per_1m: 0.30,   // Gemini 2.5 Flash input  (USD / 1M tokens)
  gemini_text_out_per_1m: 2.50,  // Gemini 2.5 Flash output (USD / 1M tokens)
  gemini_image_each: 0.04,       // per generated image
  tts_per_1m_chars: 16.0,        // equiv. cloud neural TTS (edge-tts is free)
  _note: 'Actual pipeline cost is $0 (Gemini free tier, edge-tts, local FFmpeg). equivalent_usd = estimated cost on paid APIs, for reference only.',
};

const readJSON = (p) => { try { const j = JSON.parse(fs.readFileSync(p, 'utf8')); return j && j.data ? j.data : j; } catch { return null; } };
const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };
const sizeMB = (p) => { try { return Math.round((fs.statSync(p).size / 1048576) * 10) / 10; } catch { return null; } };
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const countScenes = (dir, id) => { try { const re = new RegExp('^' + escapeRe(id) + '_scene-\\d+\\.jpg$'); return fs.readdirSync(dir).filter((f) => re.test(f)).length; } catch { return 0; } };
const tokens = (chars) => Math.round((chars || 0) / 4);
const usd = (n) => Math.round(n * 10000) / 10000;
const llm = (inTok, outTok) => usd((inTok * PRICING.gemini_text_in_per_1m + outTok * PRICING.gemini_text_out_per_1m) / 1e6);
const fmtMin = (sec) => { if (!sec) return ''; const m = Math.floor(sec / 60); const s = Math.round(sec % 60); return `${m}m ${s}s`; };

const log = readJSON(path.join(LOGS, 'story-log.json')) || { used: [] };
const uploads = readJSON(path.join(DATA_DIR, 'uploads.json')) || {};

const storiesDir = path.join(OUT, 'stories');
let ids = [];
try { ids = fs.readdirSync(storiesDir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')); } catch {}
const logIds = (log.used || []).map((u) => u.id);
ids = [...new Set([...logIds.filter((i) => ids.includes(i)), ...ids])];

const builds = ids.map((id) => {
  const story = readJSON(path.join(storiesDir, id + '.json')) || {};
  const scenes = readJSON(path.join(OUT, 'scenes', id + '.json'));
  const flow = readJSON(path.join(OUT, 'flow', id + '_flow-sheet.json'));
  const audio = readJSON(path.join(OUT, 'audio', id + '_audio.json'));
  const seo = readJSON(path.join(OUT, 'seo', id + '_seo.json'));
  const logRow = (log.used || []).find((u) => u.id === id) || {};

  const imgCount = countScenes(path.join(OUT, 'images'), id);
  const hasSub = exists(path.join(OUT, 'subtitles', id + '.srt')) || exists(path.join(OUT, 'subtitles', id + '.ass'));
  const hasSlideshow = exists(path.join(OUT, 'flow_in', id + '.mp4'));
  const videoPath = path.join(OUT, 'videos', id + '.mp4');
  const hasVideo = exists(videoPath);
  const hasThumb = exists(path.join(OUT, 'thumbnails', id + '.jpg'));
  const upload = uploads[id] || { uploaded: false };

  const sceneCount = (scenes && (scenes.scene_count ?? (scenes.scenes ? scenes.scenes.length : 0))) || 0;
  const wordCount = story.word_count ?? (scenes && scenes.total_words) ?? 0;
  const narrChars = ((scenes && scenes.scenes) || []).reduce((s, x) => s + ((x.narration || '').length), 0);
  const audioDur = (audio && audio.total_audio_duration_seconds) ?? (scenes && scenes.total_duration_seconds) ?? null;
  const characters = story.characters || [];

  const steps = [];
  const st = (key, mod, label, engine, status, detail) => steps.push({ key, module: mod, label, engine, status, detail: detail || '' });
  st('story', '04', 'Story', 'Gemini 2.5 Flash', story.story_text ? 'done' : 'pending', wordCount ? wordCount + ' words' : '');
  st('characters', '06', 'Character Memory', 'Gemini 2.5 Flash', characters.length ? 'done' : 'pending', characters.length ? characters.map((c) => c.name).join(', ') : '');
  st('scenes', '05', 'Scene Breakdown', 'Gemini 2.5 Flash', scenes ? 'done' : 'pending', sceneCount ? sceneCount + ' scenes' : '');
  st('prompts', '10a', 'Cinematic Prompts', 'Gemini 2.5 Flash', flow ? 'done' : 'pending', flow && flow.shots ? flow.shots.length + ' shots' : '');
  st('images', '07', 'Scene Images', 'Gemini Image', imgCount ? (sceneCount > 0 && imgCount >= sceneCount ? 'done' : 'partial') : 'pending', sceneCount ? imgCount + '/' + sceneCount : String(imgCount));
  st('narration', '08', 'Narration (TTS)', (audio && audio.tts_engine) || 'edge-tts', audio ? 'done' : 'pending', audio ? audio.clip_count + ' clips · ' + fmtMin(audioDur) : '');
  st('subtitles', '09', 'Subtitles', 'local', hasSub ? 'done' : 'pending', '');
  st('slideshow', '10', 'Slideshow (Ken Burns)', 'FFmpeg', hasSlideshow ? 'done' : 'pending', '');
  st('assemble', '10b', 'Assemble Video', 'FFmpeg', hasVideo ? 'done' : 'pending', hasVideo ? sizeMB(videoPath) + ' MB' : '');
  st('thumbnail', '11', 'Thumbnail', 'Gemini Image', hasThumb ? 'done' : 'pending', '');
  st('seo', '12', 'SEO Metadata', 'Gemini 2.5 Flash', seo ? 'done' : 'pending', seo && seo.youtube ? 'title · desc · tags' : '');
  st('upload', '13', 'YouTube Upload', 'YouTube API', upload.uploaded ? 'done' : 'pending', upload.uploaded ? upload.privacy : '');

  const doneCount = steps.filter((s) => s.status === 'done').length;

  const cb = [];
  const push = (step, label, equivalent, detail) => cb.push({ step, label, actual_usd: 0, equivalent_usd: usd(equivalent), detail });
  if (story.story_text) push('story', 'Story generation', llm(1200, tokens(story.story_text.length) + tokens(JSON.stringify(characters).length)), '~' + tokens(story.story_text.length) + ' output tokens');
  if (scenes) push('scenes', 'Scene breakdown', llm(tokens((story.story_text || '').length), tokens(JSON.stringify(scenes.scenes || []).length)), sceneCount + ' scenes');
  if (flow) push('prompts', 'Cinematic prompts', llm(tokens(JSON.stringify((scenes && scenes.scenes) || []).length), tokens(JSON.stringify(flow.shots || []).length)), ((flow.shots && flow.shots.length) || 0) + ' shots');
  if (imgCount) push('images', 'Scene images', imgCount * PRICING.gemini_image_each, imgCount + ' × $' + PRICING.gemini_image_each);
  if (audio) push('narration', 'Narration — edge-tts is FREE', (narrChars * PRICING.tts_per_1m_chars) / 1e6, narrChars.toLocaleString() + ' chars');
  if (hasThumb) push('thumbnail', 'Thumbnail image', PRICING.gemini_image_each, '1 image');
  if (seo) push('seo', 'SEO metadata', llm(tokens((story.story_text || '').length), 500), 'title / description / tags');
  const equivalent = usd(cb.reduce((s, x) => s + x.equivalent_usd, 0));

  const status = upload.uploaded ? 'complete' : doneCount > 0 ? 'in_progress' : 'pending';

  return {
    id,
    title: story.title || logRow.title || id,
    date: story.date || id.slice(0, 10),
    theme: story.theme || logRow.theme || '',
    moral: story.moral || '',
    brand: 'boopaloo',
    format: 'long',
    status,
    progress: { done: doneCount, total: steps.length },
    scene_count: sceneCount,
    word_count: wordCount,
    video: {
      has_final: hasVideo,
      size_mb: hasVideo ? sizeMB(videoPath) : null,
      resolution: hasVideo ? '1920×1080' : null,
      duration_seconds: audioDur,
      source: 'stills slideshow',
    },
    upload: {
      uploaded: !!upload.uploaded,
      url: upload.url || null,
      video_id: upload.video_id || null,
      privacy: upload.privacy || null,
    },
    meta: {
      text_model: story.model || 'gemini-2.5-flash',
      voice: (audio && audio.voice) || null,
      tts_engine: (audio && audio.tts_engine) || null,
    },
    steps,
    cost: { actual_usd: 0, equivalent_usd: equivalent, breakdown: cb },
  };
});

// --- ASMR Papercut shorts (brand A) ------------------------------------------
// Scans output/asmr/** and produces board entries with ASMR-specific step keys.
// Returns [] until the ASMR pipeline has run, so this is safe on the current data.
const VEO_FAST_PER_SEC = 0.15; // rough Veo Fast estimate (USD / sec of generated video)
const dirCount = (dir, re) => { try { return fs.readdirSync(dir).filter((f) => re.test(f)).length; } catch { return 0; } };

function collectAsmr() {
  const ideasDir = path.join(OUT, 'asmr', 'ideas');
  let aIds = [];
  try { aIds = fs.readdirSync(ideasDir).filter((f) => f.endsWith('.json') && f !== 'used.json').map((f) => f.replace(/\.json$/, '')); } catch { return []; }

  return aIds.map((id) => {
    const concept = readJSON(path.join(ideasDir, id + '.json')) || {};
    const scenes = readJSON(path.join(OUT, 'asmr', 'scenes', id + '.json'));
    const prompts = readJSON(path.join(OUT, 'asmr', 'veo', id + '_prompts.json'));
    const meta = readJSON(path.join(OUT, 'asmr', 'meta', id + '.json'));
    const upload = uploads[id] || { uploaded: false };

    const sceneCount = (scenes && (scenes.scenes ? scenes.scenes.length : 0)) || 0;
    const clipCount = dirCount(path.join(OUT, 'asmr', 'clips', id), /\.mp4$/);
    const frameCount = dirCount(path.join(OUT, 'asmr', 'frames', id), /\.png$/);
    const hasAudio = exists(path.join(OUT, 'asmr', 'audio', id + '.wav'));
    const videoPath = path.join(OUT, 'asmr', 'videos', id + '.mp4');
    const hasVideo = exists(videoPath);
    const hasThumb = exists(path.join(OUT, 'asmr', 'thumbnails', id + '.jpg'));

    const assetsReady = Array.isArray(concept.props || concept.characters)
      ? [...(concept.characters || []), ...(concept.props || [])].every((a) => a && a.asset_status === 'ready')
      : false;

    const steps = [];
    const st = (key, mod, label, engine, status, detail) => steps.push({ key, module: mod, label, engine, status, detail: detail || '' });
    st('idea', 'A01', 'Concept', 'Gemini 2.5 Flash', concept.title ? 'done' : 'pending', concept.subject || '');
    st('assets', 'A02/03', 'Assets', 'Nano Banana', frameCount || assetsReady ? 'done' : 'pending', '');
    st('storyboard', 'A04', 'Storyboard', 'Gemini 2.5 Flash', scenes ? 'done' : 'pending', sceneCount ? sceneCount + ' scenes' : '');
    st('veo_prompts', 'A05', 'Veo Prompts', 'Gemini 2.5 Flash', prompts ? 'done' : 'pending', '');
    st('clips', 'A06', 'Veo Clips', 'Veo', clipCount ? (sceneCount && clipCount >= sceneCount ? 'done' : 'partial') : 'pending', sceneCount ? clipCount + '/' + sceneCount : String(clipCount));
    st('audio', 'A07', 'ASMR Audio', 'SFX', hasAudio ? 'done' : 'pending', '');
    st('assemble', 'A09', 'Assemble', 'FFmpeg', hasVideo ? 'done' : 'pending', hasVideo ? sizeMB(videoPath) + ' MB' : '');
    st('thumbnail', 'A10', 'Thumbnail', 'Nano Banana', hasThumb ? 'done' : 'pending', '');
    st('seo', 'A11', 'SEO', 'Gemini 2.5 Flash', meta ? 'done' : 'pending', '');
    st('upload', 'A12', 'Upload', 'YouTube API', upload.uploaded ? 'done' : 'pending', upload.uploaded ? upload.privacy : '');

    const doneCount = steps.filter((s) => s.status === 'done').length;
    const duration = sceneCount * 8;
    const actual = usd(clipCount * 8 * VEO_FAST_PER_SEC + frameCount * PRICING.gemini_image_each);
    const status = upload.uploaded ? 'complete' : doneCount > 0 ? 'in_progress' : 'pending';

    return {
      id,
      title: concept.title || id,
      date: concept.date || id.slice(0, 10),
      theme: concept.subject || '',
      moral: '',
      brand: 'asmr_papercut',
      format: 'short',
      status,
      progress: { done: doneCount, total: steps.length },
      scene_count: sceneCount,
      word_count: 0,
      video: { has_final: hasVideo, size_mb: hasVideo ? sizeMB(videoPath) : null, resolution: hasVideo ? '1080×1920' : null, duration_seconds: hasVideo ? duration : null, source: 'veo clips' },
      upload: { uploaded: !!upload.uploaded, url: upload.url || null, video_id: upload.video_id || null, privacy: upload.privacy || null },
      meta: { text_model: 'gemini-2.5-flash', voice: null, tts_engine: null },
      steps,
      cost: { actual_usd: actual, equivalent_usd: actual, breakdown: [] },
    };
  });
}

const asmrBuilds = collectAsmr();
const allBuilds = [...builds, ...asmrBuilds];

// --- Asset Library → data/assets.json (for the /assets gallery) ---------------
try {
  const reg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), '..', 'prompts', 'asset-registry.json'), 'utf8'));
  const flat = [];
  for (const kind of ['characters', 'props']) {
    for (const [slug, e] of Object.entries(reg[kind] || {})) {
      flat.push({
        slug, name: e.name || slug, kind: kind === 'characters' ? 'character' : 'prop',
        visual_description: e.visual_description || '', asset_status: e.asset_status || 'missing',
        asset_path: e.asset_path || null, public_path: null,
        brands: e.brands || [], times_seen: e.times_seen || 0,
      });
    }
  }
  fs.writeFileSync(path.join(DATA_DIR, 'assets.json'), JSON.stringify({ generated_at: new Date().toISOString(), assets: flat }, null, 2));
  console.log(`Wrote data/assets.json: ${flat.length} assets`);
} catch (e) { console.warn('assets.json skipped:', e.message); }

// Merge with previously-committed builds so history survives ephemeral cloud runs:
// a GitHub runner only has the CURRENT story's files in output/, so we upsert the
// freshly-computed entries onto whatever builds.json already holds.
let merged = allBuilds;
try {
  const existing = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'builds.json'), 'utf8'));
  const byId = new Map((existing.builds || []).map((b) => [b.id, b]));
  for (const b of allBuilds) byId.set(b.id, b);
  merged = [...byId.values()];
} catch {}
merged.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

const out = {
  generated_at: new Date().toISOString(),
  pricing: PRICING,
  totals: {
    builds: merged.length,
    uploaded: merged.filter((b) => b.upload.uploaded).length,
    videos: merged.filter((b) => b.video.has_final).length,
    total_minutes: Math.round(merged.reduce((s, b) => s + ((b.video.duration_seconds || 0) / 60), 0) * 10) / 10,
    actual_usd: 0,
    equivalent_usd: usd(merged.reduce((s, b) => s + b.cost.equivalent_usd, 0)),
  },
  builds: merged,
};

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(path.join(DATA_DIR, 'builds.json'), JSON.stringify(out, null, 2));
console.log(`Wrote data/builds.json: ${out.totals.builds} builds, ${out.totals.uploaded} uploaded, ${out.totals.videos} videos, equiv $${out.totals.equivalent_usd}`);
