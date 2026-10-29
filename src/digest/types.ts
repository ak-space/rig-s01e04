// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One job's night, folded from its lines in runs/<night>.jsonl.
export type DigestRow = {
  job: string;
  owner: string | null; // null in the log stays null; views render it as —
  runs: number; // lines for this job
  retries: number; // lines with status "retry"
  lastStatus: RunStatus;
  lastError: string | null; // error of the last line that had one
  firstAt: string; // `at` as written in the log, offset kept (styleguide)
  lastAt: string;
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that did not parse; counted, never thrown
};

// null when there is no file for that night (route → 404). An empty file gives rows: [].
export type ReadNight = (runsDir: string, night: string) => Night | null;
