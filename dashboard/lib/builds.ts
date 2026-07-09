import data from '@/data/builds.json';
import type { BuildsFile, Build } from './types';

export function getBuildsFile(): BuildsFile {
  return data as unknown as BuildsFile;
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
