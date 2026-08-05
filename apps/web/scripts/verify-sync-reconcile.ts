/**
 * Pin the MODUS Desktop delete decision.
 *
 * Every `true` here deletes one of the user's real notes, permanently, with no
 * trash and no UI that would show it happening. Every `false` leaves a note the
 * user already deleted whispering into the model's context. Both directions are
 * asserted, because the obvious way to make deletion "work" — treat anything
 * missing from the payload as deleted — is exactly how you wipe someone's
 * Notes app the first time a read is truncated or a store fails to open.
 *
 *   cd apps/web && npx tsx scripts/verify-sync-reconcile.ts
 */
import {
  planReconcile,
  reminderDocId,
  contentHash,
  shouldWrite,
  ALL_IDS_CEILING,
  type SkipReason,
} from '../lib/desktop/reconcile';

let failures = 0;

function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? `  — ${detail}` : ''}`);
}

function ids(prefix: string, n: number, from = 0): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}${from + i}`);
}

/** Asserts the exact delete set, order-insensitively. */
function expectDeletes(
  name: string,
  plan: ReturnType<typeof planReconcile>,
  want: string[],
  why: string,
) {
  const got = [...plan.deleteIds].sort();
  const ok = plan.skipped === null && JSON.stringify(got) === JSON.stringify([...want].sort());
  check(
    `DELETE ${JSON.stringify(want)} ${name}`,
    ok,
    ok ? why : `got ${JSON.stringify(got)} skipped=${plan.skipped}`,
  );
}

function expectSkip(
  name: string,
  plan: ReturnType<typeof planReconcile>,
  want: SkipReason,
  why: string,
) {
  const ok = plan.skipped === want && plan.deleteIds.length === 0;
  check(
    `skip   ${want.padEnd(19)} ${name}`,
    ok,
    ok ? why : `got skipped=${plan.skipped} deletes=${plan.deleteIds.length}`,
  );
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n── MUST DELETE ──');

expectDeletes(
  'note deleted in Apple Notes',
  planReconcile({
    existingIds: ['a', 'b', 'c'],
    recordDocIds: ['a', 'b'],
    sync: { allIds: ['a', 'b'], complete: true },
  }),
  ['c'],
  'the case this whole change exists for',
);

expectDeletes(
  'note locked or moved to Recently Deleted',
  planReconcile({
    existingIds: ['kept', 'nowLocked'],
    recordDocIds: ['kept'],
    // the id query joins ZCRYPTOINITIALIZATIONVECTOR IS NULL, so a locked
    // note leaves allIds and its stale plaintext body must go with it
    sync: { allIds: ['kept'], complete: true },
  }),
  ['nowLocked'],
  'locking a note must retract the plaintext already in Firestore',
);

expectDeletes(
  'reminder id maps through reminderDocId',
  planReconcile({
    existingIds: ['apple-1', 'apple-2'],
    recordDocIds: ['apple-1'],
    sync: { allIds: ['1'], complete: true },
    toDocId: reminderDocId,
  }),
  ['apple-2'],
  'allIds carries raw ZIDENTIFIERs, existingIds carries doc ids',
);

expectDeletes(
  'proportional cleanup of 20 out of 400',
  planReconcile({
    existingIds: ids('n', 400),
    recordDocIds: ids('n', 380),
    sync: { allIds: ids('n', 380), complete: true },
  }),
  ids('n', 20, 380),
  'well under the breaker — a real folder cleanup must still work',
);

expectDeletes(
  'user deleted their last few notes',
  planReconcile({
    existingIds: ['a', 'b', 'c'],
    recordDocIds: [],
    sync: { allIds: ['a'], complete: true },
  }),
  ['b', 'c'],
  'empty records with a non-empty id list is legitimate',
);

// ───────────────────────────────────────────────────────────────────────────
console.log('\n── MUST NOT DELETE (the point of the change) ──');

expectSkip(
  'legacy desktop build',
  planReconcile({
    existingIds: ['a', 'b', 'c'],
    recordDocIds: ['a'],
    sync: undefined,
  }),
  'no-envelope',
  '0.2.0 in the wild sends no envelope and must never trigger deletes',
);

expectSkip(
  'one of two reminder stores failed to open',
  planReconcile({
    // iCloud + Exchange; the iCloud snapshot threw and was swallowed
    existingIds: ['apple-icloud1', 'apple-icloud2', 'apple-exch1'],
    recordDocIds: ['apple-exch1'],
    sync: { allIds: ['exch1'], complete: false },
    toDocId: reminderDocId,
  }),
  'incomplete',
  'BUG 1: this silently soft-deleted every task from the failed account',
);

{
  // Note the expected outcome is a clean pass, NOT a guard trip: allIds covers
  // all 900, so nothing is missing and there is nothing for the breaker to
  // catch. The cap is defused at the source, not caught downstream.
  const plan = planReconcile({
    existingIds: ids('n', 900),
    recordDocIds: ids('n', 500),
    sync: { allIds: ids('n', 900), complete: true },
  });
  check(
    'MAX_NOTES cap truncated records to 500 of 900, zero deletes',
    plan.deleteIds.length === 0 && plan.skipped === null,
    'BUG 2: reconciling off records would have deleted notes 501-900 every sync',
  );
}

{
  const plan = planReconcile({
    existingIds: ids('apple-r', 400),
    recordDocIds: ids('apple-r', 300),
    sync: { allIds: ids('r', 400), complete: true },
    toDocId: reminderDocId,
  });
  check(
    'MAX_REMINDERS per-store cap produces zero deletes',
    plan.deleteIds.length === 0 && plan.skipped === null,
    'BUG 2: 300-per-store LIMIT deleted every reminder past the cap, deterministically',
  );
}

expectSkip(
  'id query returned nothing',
  planReconcile({
    existingIds: ids('n', 400),
    recordDocIds: [],
    sync: { allIds: [], complete: true },
  }),
  'empty-ids',
  'a future macOS schema change must not read as "delete all 400"',
);

expectSkip(
  'client contradicted itself',
  planReconcile({
    existingIds: ['a', 'b'],
    recordDocIds: ['a', 'ghost'],
    sync: { allIds: ['a', 'b'], complete: true },
  }),
  'records-not-subset',
  'sent a record it then omitted from its own id list',
);

expectSkip(
  'allIds one over the ceiling',
  planReconcile({
    existingIds: ids('n', 10),
    recordDocIds: [],
    sync: { allIds: ids('n', ALL_IDS_CEILING + 1), complete: true },
  }),
  'too-many-ids',
  'refuse, never .slice() — truncating allIds IS mass deletion',
);

expectSkip(
  'disproportionate delete',
  planReconcile({
    existingIds: ids('n', 400),
    recordDocIds: ids('n', 5),
    sync: { allIds: ids('n', 5), complete: true },
  }),
  'mass-delete-guard',
  'a half-broken read that passed every other check',
);

{
  const plan = planReconcile({
    existingIds: ['mine1', 'theirs1', 'theirs2'],
    recordDocIds: ['mine1'],
    sync: { allIds: ['mine1'], complete: true },
    protectedIds: new Set(['theirs1', 'theirs2']),
  });
  check(
    'docs from another Mac are never deleted',
    plan.deleteIds.length === 0 && plan.skipped === null,
    'two Macs on different iCloud accounts would otherwise wipe each other every 5 min',
  );
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n── INVARIANTS ──');

{
  // Containment: a delete op must never name a doc that was not already there.
  const cases: Array<Parameters<typeof planReconcile>[0]> = [
    { existingIds: ['a', 'b', 'c'], recordDocIds: ['a'], sync: { allIds: ['a'], complete: true } },
    {
      existingIds: ['apple-1', 'apple-2'],
      recordDocIds: [],
      sync: { allIds: ['1'], complete: true },
      toDocId: reminderDocId,
    },
    { existingIds: ids('n', 400), recordDocIds: [], sync: { allIds: ids('n', 380), complete: true } },
  ];
  const ok = cases.every((c) => {
    const set = new Set(c.existingIds);
    return planReconcile(c).deleteIds.every((id) => set.has(id));
  });
  check(
    'deleteIds is always a subset of existingIds',
    ok,
    'a manually created MODUS task can never be returned as a delete',
  );
}

{
  const first = planReconcile({
    existingIds: ['a', 'b', 'c'],
    recordDocIds: ['a'],
    sync: { allIds: ['a'], complete: true },
  });
  const remaining = ['a', 'b', 'c'].filter((id) => !first.deleteIds.includes(id));
  const second = planReconcile({
    existingIds: remaining,
    recordDocIds: ['a'],
    sync: { allIds: ['a'], complete: true },
  });
  check(
    'idempotent: re-running after the delete is a no-op',
    second.deleteIds.length === 0 && second.skipped === null,
    'a stuck sync loop must not keep issuing writes',
  );
}

{
  const plan = planReconcile({
    existingIds: ['a', 'b'],
    recordDocIds: ['a'],
    // duplicates, empty string, slash, dot-dot — all must normalise away
    sync: { allIds: ['a', 'a', '', '  ', 'x/y', '..', '.', 'b'], complete: true },
  });
  check(
    'garbage ids in allIds normalise away',
    plan.deleteIds.length === 0 && plan.skipped === null,
    'a and b both survive; the junk neither keeps nor deletes anything',
  );
}

{
  const plan = planReconcile({
    existingIds: ['a'],
    recordDocIds: [],
    sync: { allIds: 'not-an-array' as unknown, complete: true },
  });
  check(
    'non-array allIds is treated as incomplete',
    plan.skipped === 'incomplete' && plan.deleteIds.length === 0,
    'the payload is user-controlled JSON, not a typed object',
  );
}

{
  const plan = planReconcile({
    existingIds: ['a'],
    recordDocIds: [],
    sync: { allIds: ['x'], complete: 'true' as unknown },
  });
  check(
    'truthy-but-not-true complete is rejected',
    plan.skipped === 'incomplete' && plan.deleteIds.length === 0,
    'strict === true, so a stringly-typed client cannot opt itself in',
  );
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n── WRITE SKIP ──');

const baseFields = {
  title: 'Groceries',
  body: 'milk\neggs',
  folder: 'Notes',
  source: 'desktop-apple-notes',
  modifiedAt: 1_700_000_000_000,
};
const baseHash = contentHash(baseFields);

check(
  'identical content does not write',
  !shouldWrite(baseHash, contentHash({ ...baseFields })),
  'this is what removes ~150k writes/day/user',
);
check(
  'changed body writes',
  shouldWrite(baseHash, contentHash({ ...baseFields, body: 'milk\neggs\nbread' })),
  'edited note must reach the model',
);
check(
  'changed modifiedAt writes even when the body is identical',
  shouldWrite(baseHash, contentHash({ ...baseFields, modifiedAt: 1_700_000_999_000 })),
  'fetchNotesBlock and /notes both order by modifiedAt — it must stay accurate',
);
check(
  'doc with no stored hash writes once',
  shouldWrite(undefined, baseHash),
  'every doc predating this change rewrites exactly once, then goes quiet',
);
check(
  'hash is stable across key insertion order',
  contentHash({ body: 'x', title: 'y' }) === contentHash({ title: 'y', body: 'x' }),
  'object key order must never cause a spurious rewrite',
);
check(
  'undefined and null hash identically',
  contentHash({ folder: undefined, title: 't' }) === contentHash({ folder: null, title: 't' }),
  'Firestore stores the null; the record carried undefined',
);

{
  // Every single field must move the hash. This is what proves freezing
  // `updatedAt` is safe: nothing writable can change without being noticed.
  const missed = Object.keys(baseFields).filter((k) => {
    const mutated = { ...baseFields, [k]: `${String((baseFields as never)[k])}__changed` };
    return contentHash(mutated) === baseHash;
  });
  check(
    'every field change moves the hash',
    missed.length === 0,
    missed.length ? `blind to: ${missed.join(', ')}` : 'no field can drift silently',
  );
}

console.log(`\n${failures === 0 ? '✅ all checks passed' : `❌ ${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
