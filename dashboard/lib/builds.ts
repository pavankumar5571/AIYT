import data from '@/data/builds.json';
import statusData from '@/data/status.json';
import type { BuildsFile, Build, RunStatus } from './types';

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
