/**
 * Pin the per-source read isolation in tray.ts runSync.
 *
 * The server deletes synced docs based on `complete: true`. This script asserts
 * the only three ways that flag is allowed to be true, and the four ways a
 * broken read must force it false — because `complete` reaching the server
 * wrongly is how you delete somebody's Apple Notes, and it is a boolean that
 * defaults to the dangerous value if anyone ever "simplifies" a catch block.
 *
 * It also pins that one failing source cannot take the other two down, which is
 * the exact regression the old three-statements-in-one-try runSync had.
 *
 * Pure logic. No SQLite, no Electron, no network.
 *
 *   cd apps/desktop && npx tsx scripts/verify-source-envelope.ts
 */

interface SourceRead<T> { records: T[]; allIds: string[]; complete: boolean }
type Rec = { id: string };

let failures = 0;
function check(name: string, ok: boolean, why: string) {
  if (!ok) failures++;
  console.log(`${ok ? '✅' : '❌'} ${name}  — ${why}`);
}

const logged: string[] = [];
const log = { error: (m: string) => logged.push(m) };

/**
 * Verbatim copy of readSource from src/main/tray.ts.
 *
 * ⚠️ Duplicated on purpose: importing tray.ts pulls in `electron`, which cannot
 * load outside an Electron process. If you change the original, change this and
 * watch these assertions move.
 */
function readSource<R extends SourceRead<Rec>>(
  name: string,
  granted: boolean,
  read: () => R,
  empty: R,
): R {
  if (!granted) return empty;
  try {
    const r = read();
    const ids = new Set(r.allIds);
    if (!r.records.every((x) => ids.has(x.id))) {
      log.error(`[sync] ${name}: records not a subset of allIds, forcing incomplete`);
      return { ...r, complete: false };
    }
    return r;
  } catch (err) {
    log.error(`[sync] ${name} read failed, other sources continue`, err as never);
    return empty;
  }
}

const empty: SourceRead<Rec> = { records: [], allIds: [], complete: false };
const ok: SourceRead<Rec> = {
  records: [{ id: 'a' }, { id: 'b' }],
  allIds: ['a', 'b', 'c'],
  complete: true,
};

console.log('\n── complete may be TRUE ──');

{
  const r = readSource('notes', true, () => ok, empty);
  check(
    'a clean read passes complete:true through',
    r.complete === true && r.allIds.length === 3,
    'the normal case — deletions must actually be allowed to happen',
  );
}
{
  // records is a strict subset because MAX_NOTES capped it. That is expected
  // and must NOT block reconciliation, or the cap silently disables deletion.
  const r = readSource('notes', true, () => ({ ...ok, records: [{ id: 'a' }] }), empty);
  check(
    'a capped record list still allows reconciliation',
    r.complete === true,
    'records is lossy by design; allIds is the one that must be whole',
  );
}

console.log('\n── complete MUST be FALSE ──');

{
  const r = readSource('notes', false, () => ok, empty);
  check(
    'Full Disk Access denied yields complete:false',
    r.complete === false && r.records.length === 0 && r.allIds.length === 0,
    'revoking FDA must never read as "the user deleted everything"',
  );
}
{
  const r = readSource('notes', true, () => { throw new Error('snapshot failed'); }, empty);
  check(
    'a throwing reader yields complete:false',
    r.complete === false && r.allIds.length === 0,
    'a flaky NoteStore copy must cost staleness, never data',
  );
}
{
  const r = readSource(
    'notes',
    true,
    () => ({ records: [{ id: 'ghost' }], allIds: ['a'], complete: true }),
    empty,
  );
  check(
    'records not a subset of allIds forces complete:false',
    r.complete === false,
    'the two queries disagreed; the delete mandate is not trustworthy',
  );
}
{
  // What appleReminders does when one of two account stores fails to open.
  const partial: SourceRead<Rec> = {
    records: [{ id: 'exch1' }],
    allIds: ['exch1'],
    complete: false,
  };
  const r = readSource('reminders', true, () => partial, empty);
  check(
    'a self-reported partial read stays complete:false',
    r.complete === false && r.records.length === 1,
    'BUG 1: this partial list used to soft-delete every task from the failed account',
  );
}

console.log('\n── one broken source must not take the others down ──');

{
  logged.length = 0;
  const notes = readSource('notes', true, () => { throw new Error('boom'); }, empty);
  const messages = readSource('messages', true, () => ok, empty);
  const reminders = readSource('reminders', true, () => ok, empty);
  check(
    'messages and reminders survive a throwing notes read',
    notes.complete === false &&
      messages.records.length === 2 &&
      reminders.records.length === 2 &&
      messages.complete === true,
    'these were three statements in one try — notes threw and all three died',
  );
  check(
    'the failure is logged, not swallowed',
    logged.some((m) => m.includes('notes read failed')),
    'a silently disabled sync is indistinguishable from a working one',
  );
}

console.log('\n── payload-hash skip ──');

{
  // The skip must key on the WHOLE payload, envelope included. Keying on
  // records alone would skip a POST that carries a new deletion.
  const hashOf = (o: unknown) => JSON.stringify(o);
  const base = { notes: [{ id: 'a' }], sync: { notes: { allIds: ['a', 'b'], complete: true } } };
  const deleted = { notes: [{ id: 'a' }], sync: { notes: { allIds: ['a'], complete: true } } };
  check(
    'a deletion changes the payload hash even when records are identical',
    hashOf(base) !== hashOf(deleted),
    'otherwise the sync that carries the delete is the one that gets skipped',
  );
}

console.log(`\n${failures === 0 ? '✅ all checks passed' : `❌ ${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
