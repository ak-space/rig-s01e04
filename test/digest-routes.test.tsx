import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

const GOOD = [
  '{"at":"2026-10-28T02:00:00+01:00","job":"zeta-sync","status":"ok","owner":"anna"}',
  '{"at":"2026-10-28T02:05:00+01:00","job":"alpha-backup","status":"retry","owner":null,"error":"timeout"}',
  '{"at":"2026-10-28T02:09:00+01:00","job":"alpha-backup","status":"ok","owner":null}',
  '{"at":"2026-10-28T03:00:00+01:00","job":"mid-report","status":"fail","owner":"piotr","error":"disk full"}',
].join('\n');

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(join(dir, '2026-10-28.jsonl'), GOOD + '\n');
  writeFileSync(join(dir, '2026-10-27.jsonl'), '');
  writeFileSync(join(dir, '2026-10-26.jsonl'), GOOD + '\nthis is not json\n');
  process.env.LANE_MARKER = 'TEST-MARKER';
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const JOBS = ['alpha-backup', 'mid-report', 'zeta-sync'];

describe('GET /digest/:night', () => {
  it('renders heading, lane banner and a row per job sorted by job', async () => {
    const res = await app.request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest 2026-10-28');
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('<table');
    expect((html.match(/<tr/g) ?? []).length).toBeGreaterThanOrEqual(JOBS.length);
    const at = JOBS.map((j) => html.indexOf(j));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('404s for a night with no file', async () => {
    const res = await app.request('/digest/2020-01-01');
    expect(res.status).toBe(404);
  });

  it('says nothing ran for an empty file', async () => {
    const res = await app.request('/digest/2026-10-27');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('lists the good jobs and reports a bad line', async () => {
    const res = await app.request('/digest/2026-10-26');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const j of JOBS) expect(html).toContain(j);
    expect(html).toContain('could not be read');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns night, sorted rows and badLines 0', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    const body = (await res.json()) as { night: string; rows: DigestRow[]; badLines: number };
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-10-28');
    expect(body.rows.map((r) => r.job)).toEqual(JOBS);
    expect(body.rows[0]).toMatchObject({ job: 'alpha-backup', runs: 2, retries: 1, lastStatus: 'ok' });
    expect(body.badLines).toBe(0);
  });

  it('404s for a night with no file', async () => {
    expect((await app.request('/api/digest/2020-01-01')).status).toBe(404);
  });

  it('gives no rows and no bad lines for an empty file', async () => {
    const res = await app.request('/api/digest/2026-10-27');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ night: '2026-10-27', rows: [], badLines: 0 });
  });

  it('counts a bad line without dropping good rows', async () => {
    const res = await app.request('/api/digest/2026-10-26');
    const body = (await res.json()) as { rows: DigestRow[]; badLines: number };
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(3);
  });
});

describe('page and JSON agree', () => {
  it('job order in the HTML matches the JSON rows', async () => {
    const html = await (await app.request('/digest/2026-10-28')).text();
    const body = (await (await app.request('/api/digest/2026-10-28')).json()) as { rows: DigestRow[] };
    const names = body.rows.map((r) => r.job);
    const htmlOrder = names.map((j) => ({ j, i: html.indexOf(j) })).sort((a, b) => a.i - b.i).map((x) => x.j);
    expect(htmlOrder).toEqual(names);
  });
});
