// Real progress for streaming blocks.
//
// A chart of 21 points sat behind a static "Building chart…" for ~30s with no
// sense of whether it was nearly done or stuck. Blocks stream as ordered JSON,
// so if the model states the total BEFORE the array (chart: "points", document:
// "words"), the arriving rows can be counted against it for a true percentage.
//
// Deliberately no time-based estimate: a percentage that stalls at 95% is a
// lie, and this codebase has already decided on real phases over fake ones.

export type BlockProgress = {
  label: string;
  /** 0-100, or null when the model didn't declare a total (indeterminate). */
  percent: number | null;
  /** Human detail, e.g. "12 of 21 points". Empty when there's nothing honest to say. */
  detail: string;
};

/** Reads a number field out of a partial (still-streaming, unclosed) JSON block. */
function readNumberField(raw: string, field: string): number | null {
  const m = new RegExp(`"${field}"\\s*:\\s*(\\d{1,6})`).exec(raw);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Counts objects already emitted inside "data": [ ... ].
 * Counts each row's CLOSING brace, so a half-written row isn't counted early.
 * String contents are skipped so a label like "a}b" can't inflate the count.
 */
export function countStreamedRows(raw: string): number {
  const start = raw.search(/"data"\s*:\s*\[/);
  if (start === -1) return 0;
  const from = raw.indexOf('[', start);
  if (from === -1) return 0;

  let rows = 0, depth = 0, inString = false, escaped = false;
  for (let i = from + 1; i < raw.length; i++) {
    const c = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) rows++; }
    else if (c === ']' && depth === 0) break; // end of the data array
  }
  return rows;
}

/** Words emitted so far inside a document block's "markdown" string. */
function countStreamedWords(raw: string): number {
  const m = /"markdown"\s*:\s*"/.exec(raw);
  if (!m) return 0;
  const body = raw.slice(m.index + m[0].length);
  // Unescaped closing quote ends the field; while streaming there usually isn't one.
  const end = /(?<!\\)"/.exec(body);
  const text = (end ? body.slice(0, end.index) : body).replace(/\\n/g, ' ');
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function pct(done: number, total: number): number {
  // Capped at 99 while streaming: 100% must mean rendered, not "last row seen".
  return Math.max(1, Math.min(99, Math.round((done / total) * 100)));
}

/**
 * Progress for the block currently streaming in `raw`, or null if none is.
 * `raw` is the assistant text so far, including the unclosed block.
 */
export function blockProgress(raw: string): BlockProgress | null {
  if (raw.includes('```chart')) {
    const total = readNumberField(raw, 'points');
    const done = countStreamedRows(raw);
    if (total && done > 0) {
      return {
        label: 'Building chart',
        percent: pct(done, total),
        detail: `${Math.min(done, total)} of ${total} points`,
      };
    }
    // Model didn't declare "points" (or hasn't reached data yet): stay honest.
    return {
      label: 'Building chart',
      percent: null,
      detail: done > 0 ? `${done} point${done === 1 ? '' : 's'} so far` : '',
    };
  }

  if (raw.includes('```document')) {
    const total = readNumberField(raw, 'words');
    const done = countStreamedWords(raw);
    if (total && done > 0) {
      return { label: 'Writing document', percent: pct(done, total), detail: `${Math.min(done, total)} of ~${total} words` };
    }
    return { label: 'Writing document', percent: null, detail: done > 0 ? `${done} words so far` : '' };
  }

  if (raw.includes('```image'))         return { label: 'Creating image', percent: null, detail: '' };
  if (raw.includes('```options'))       return { label: 'Preparing question', percent: null, detail: '' };
  if (raw.includes('```draft_options')) return { label: 'Preparing options', percent: null, detail: '' };
  if (raw.includes('```approval'))      return { label: 'Preparing action', percent: null, detail: '' };
  return null;
}
