export type StepStatus = 'done' | 'partial' | 'pending';
export type BuildStatus = 'complete' | 'in_progress' | 'pending';

export interface Step {
  key: string;
  module: string;
  label: string;
  engine: string;
  status: StepStatus;
  detail: string;
}

export interface CostLine {
  step: string;
  label: string;
  actual_usd: number;
  equivalent_usd: number;
  detail: string;
}

export interface Build {
  id: string;
  title: string;
  date: string;
  theme: string;
  moral: string;
  status: BuildStatus;
  progress: { done: number; total: number };
  scene_count: number;
  word_count: number;
  video: {
    has_final: boolean;
    size_mb: number | null;
    resolution: string | null;
    duration_seconds: number | null;
    source: string;
  };
  upload: {
    uploaded: boolean;
    url: string | null;
    video_id: string | null;
    privacy: string | null;
  };
  meta: { text_model: string; voice: string | null; tts_engine: string | null };
  steps: Step[];
  cost: { actual_usd: number; equivalent_usd: number; breakdown: CostLine[] };
}

export interface RunStatus {
  last_run_at: string | null;
  status: 'success' | 'failed' | 'never';
  story_id: string | null;
  video_url: string | null;
  run_url: string | null;
}

export interface BuildsFile {
  generated_at: string;
  pricing: Record<string, number | string>;
  totals: {
    builds: number;
    uploaded: number;
    videos: number;
    total_minutes: number;
    actual_usd: number;
    equivalent_usd: number;
  };
  builds: Build[];
}
