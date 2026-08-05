import { adminDb } from '@/lib/firebase-admin';

/**
 * A per-user hourly cap for the small helper routes that call a model.
 *
 * 🚨 WHY THIS EXISTS. Eight routes call a model. Only /api/chat and
 * /api/chat/compare were metered or ceilinged. The rest — compare's clarify and
 * verdict, goals/plan, goals/suggestions — were reachable by any signed-in account,
 * including a free one that has already spent its 10 messages, with no cap of any
 * kind. They run cheap models (gpt-4o-mini, llama-3.3-70b) so the exposure per call
 * is small, but "small and unbounded" is still unbounded, and it is the shape that
 * only becomes visible on a bill.
 *
 * These are NOT charged against the token ceiling. They are fixed-size internal
 * calls (a 4-token classifier, a short JSON plan) that the user did not choose a
 * model for, so metering them against the chat allowance would spend the customer's
 * budget on our own plumbing. A request cap is the right instrument here, unlike
 * chat, where cost varies 27x by model and only weighted units work.
 *
 * 🔒 The check and the increment are ONE transaction. Read-then-write lets N
 * concurrent requests all observe the same count and all pass — the exact bypass
 * that verify-free-tier caught on the message counter, and that the title route
 * still has.
 */
export async function enforceAuxHourlyLimit(
  uid: string,
  surface: string,
  maxPerHour: number,
): Promise<Response | null> {
  const hourKey = `${surface}Hour`;
  const countKey = `${surface}Count`;
  const nowHour = new Date().toISOString().slice(0, 13); // "2026-08-06T01"
  const ref = adminDb.collection('users').doc(uid);

  try {
    await adminDb.runTransaction(async (txn) => {
      const snap = await txn.get(ref);
      const d = snap.data() ?? {};
      const used = d[hourKey] === nowHour ? ((d[countKey] as number) ?? 0) : 0;
      if (used >= maxPerHour) throw new Error('aux_limit_reached');
      txn.set(ref, { [hourKey]: nowHour, [countKey]: used + 1 }, { merge: true });
    });
  } catch (e) {
    if ((e as Error).message === 'aux_limit_reached') {
      return Response.json(
        { error: 'Too many requests this hour. Try again shortly.', code: 'rate_limited' },
        { status: 429 },
      );
    }
    // Fail OPEN on an infrastructure error, deliberately, and the opposite way to
    // the chat gate. A Firestore blip must not break a comparison the user is
    // already paying for, and the worst case here is a few cents of gpt-4o-mini —
    // whereas failing open on the CHAT gate would give away the product itself.
    console.error(`[aux-limit] ${surface} transaction failed, allowing`, e);
  }
  return null;
}
