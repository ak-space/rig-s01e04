import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './read.js';
import type { RunStatus } from './types.js';

export type StatusCounts = Record<RunStatus, number>;

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

// Per line, not per job: each parsed line counts once by its status. Bad lines are skipped.
// null when there is no readable file for that night.
export function countStatuses(runsDir: string, night: string): StatusCounts | null {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const l = parseLine(raw);
    if (l) counts[l.status]++;
  }
  return counts;
}
