import { describe, expect, it } from 'vitest';
import { foldNight, readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('folds runs/2026-10-28.jsonl into 5 jobs and counts the bad line', () => {
    const n = readNight('runs', '2026-10-28')!;
    expect(n.rows.map((r) => r.job)).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']);
    expect(n.badLines).toBe(1);
    const refresh = n.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(refresh).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503', firstAt: '2026-10-29T01:30:00+01:00' });
    expect(n.rows.find((r) => r.job === 'notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(n.rows.find((r) => r.job === 'digest/render')!.owner).toBeNull();
  });

  it('returns null for a night with no file, and for a malformed night', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
    expect(readNight('runs', '../etc')).toBeNull();
  });

  it('renders an empty file as no rows', () => {
    expect(foldNight('2026-01-02', '')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });
});
