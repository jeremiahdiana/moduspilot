import { redirect } from 'next/navigation';

// Notes are no longer surfaced in the UI (privacy: the desktop app still syncs
// Apple Notes into Firestore, but they are never displayed). Any deep link to
// /notes now bounces to the dashboard. The sync/data/chat-context logic is
// untouched — see lib/chat/context.ts and app/api/desktop/ingest/route.ts.
export default function NotesPage() {
  redirect('/dashboard');
}
