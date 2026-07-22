import { adminDb } from '@/lib/firebase-admin';
import { getValidAccessToken } from '@/lib/google-oauth';
import { getTodayEvents, fmtEventTime } from '@/lib/google-calendar';
import { withCap } from './context';

// Whether a chat query is asking about scheduling / a person's availability,
// which is the only time we reach into other members' calendars.
const GROUP_CTX_RE = /\b(free|available|availabilit|busy|schedul|when (is|are|'?s|will)|what time|meet|meeting|sync|catch up|calendar|book|slot)\b/i;
export function needsGroupCtx(q: string): boolean {
  return GROUP_CTX_RE.test(q);
}

interface MemberDoc {
  uid: string;
  email: string | null;
  displayName: string | null;
  sharing?: { availability?: boolean };
}

// Builds a system-prompt block describing the busy windows TODAY of every group
// member who has opted to share their availability. Only time ranges are
// exposed — never event titles, locations, or attendees — so a member's MODUS
// answers "when is Sarah free" without leaking what Sarah is doing.
export function fetchGroupAvailabilityBlock(
  uid: string,
  queryText: string,
  timezone = 'UTC',
): Promise<string> {
  if (!needsGroupCtx(queryText)) return Promise.resolve('');
  // Capped and fail-open like every other context fetcher. This one walks up to
  // four members SEQUENTIALLY per member (token refresh, then a Calendar call),
  // so it was the least bounded fetch on the whole path — and it had no try/catch
  // either, so a Firestore hiccup threw straight out of the chat route as a 500.
  return withCap(buildGroupAvailabilityBlock(uid, timezone), 5000, '', 'group availability');
}

async function buildGroupAvailabilityBlock(uid: string, timezone: string): Promise<string> {
  const userSnap = await adminDb.collection('users').doc(uid).get();
  const groupId = userSnap.data()?.groupId as string | undefined;
  if (!groupId) return '';

  const membersSnap = await adminDb.doc(`groups/${groupId}`).collection('members').get();
  const sharing = membersSnap.docs
    .map(d => d.data() as MemberDoc)
    .filter(m => m.uid !== uid && m.sharing?.availability === true);
  if (sharing.length === 0) return '';

  const lines = await Promise.all(sharing.slice(0, 4).map(async m => {
    const name = m.displayName || m.email || 'A member';
    const token = await getValidAccessToken(m.uid);
    if (!token) return `- ${name}: calendar not connected`;
    const events = await getTodayEvents(token, timezone);
    if (events.length === 0) return `- ${name}: no events today (open all day)`;
    const windows = events.map(e =>
      e.allDay ? 'busy all day' : `${fmtEventTime(e.start, timezone)}–${fmtEventTime(e.end, timezone)}`,
    );
    return `- ${name}: busy ${windows.join(', ')}`;
  }));

  return `\n\nGROUP AVAILABILITY — today (${timezone}), only members who share their calendar with the group. Use this to answer when someone is free; do not reveal what their meetings are, only the times they are busy:\n${lines.join('\n')}`;
}
