import data from '@/data/builds.json';
import statusData from '@/data/status.json';
import type { BuildsFile, Build, RunStatus, BrandInfo, Step } from './types';

export function getBuildsFile(): BuildsFile {
  return data as unknown as BuildsFile;
}

export function getStatus(): RunStatus {
  return statusData as unknown as RunStatus;
}

export function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function getBuilds(): Build[] {
  return getBuildsFile().builds;
}

export function getBuild(id: string): Build | undefined {
  return getBuilds().find((b) => b.id === id);
}

export const money = (n: number) => `$${n.toFixed(2)}`;

export function fmtDuration(sec: number | null): string {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

// ---- Kanban board: high-level pipeline stages both brands map onto ----
// Each stage owns a set of per-build step `key`s (see collect-builds.mjs). A build's
// current column = the first stage that still has unfinished work; uploaded builds land
// in the final "Published" column.
export interface Stage {
  key: string;
  label: string;
  stepKeys: string[];
}

export const STAGES: Stage[] = [
  { key: 'concept', label: 'Concept', stepKeys: ['story', 'idea'] },
  { key: 'assets', label: 'Assets', stepKeys: ['characters', 'assets'] },
  { key: 'storyboard', label: 'Storyboard', stepKeys: ['scenes', 'storyboard'] },
  { key: 'prompts', label: 'Prompts', stepKeys: ['prompts', 'veo_prompts'] },
  { key: 'video', label: 'Video', stepKeys: ['images', 'veo', 'clips', 'slideshow'] },
  { key: 'audio', label: 'Audio', stepKeys: ['narration', 'audio'] },
  { key: 'assemble', label: 'Assemble', stepKeys: ['assemble'] },
  { key: 'publish', label: 'Publish', stepKeys: ['thumbnail', 'seo', 'upload'] },
];

export const DONE_COLUMN: Stage = { key: 'published', label: 'Published', stepKeys: [] };
export const BOARD_COLUMNS: Stage[] = [...STAGES, DONE_COLUMN];

export const BRANDS: BrandInfo[] = [
  { key: 'asmr_papercut', label: 'ASMR Papercut', emoji: '✂️' },
  { key: 'boopaloo', label: 'Boopaloo Kids', emoji: '📖' },
];

export function brandOf(b: Build): BrandInfo {
  const key = b.brand || 'boopaloo';
  return BRANDS.find((x) => x.key === key) || { key, label: key, emoji: '🎬' };
}

const relevantSteps = (b: Build, stage: Stage): Step[] =>
  (b.steps || []).filter((s) => stage.stepKeys.includes(s.key));

// The column a build currently sits in.
export function currentStage(b: Build): Stage {
  if (b.upload?.uploaded) return DONE_COLUMN;
  for (const stage of STAGES) {
    const steps = relevantSteps(b, stage);
    if (steps.length === 0) continue;
    if (steps.some((s) => s.status !== 'done')) return stage;
  }
  // everything present is done but not uploaded → sitting at Publish
  return STAGES[STAGES.length - 1];
}

// Group builds into board columns, optionally filtered by brand.
export function boardColumns(builds: Build[], brandFilter?: string) {
  const list = brandFilter ? builds.filter((b) => brandOf(b).key === brandFilter) : builds;
  return BOARD_COLUMNS.map((col) => ({
    stage: col,
    builds: list.filter((b) => currentStage(b).key === col.key),
  }));
}
