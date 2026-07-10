import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import type { Metadata } from 'next';

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface SharedConversation {
  title: string;
  messages: StoredMessage[];
  createdAt: { toDate?: () => Date } | null;
}

export async function generateMetadata({ params }: { params: { shareId: string } }): Promise<Metadata> {
  try {
    const snap = await adminDb.collection('sharedConversations').doc(params.shareId).get();
    if (!snap.exists) return { title: 'MODUS — Shared conversation' };
    const data = snap.data() as SharedConversation;
    return {
      title: `${data.title} — MODUS`,
      description: 'Shared MODUS conversation',
      alternates: {
        canonical: `https://moduspilot.com/s/${params.shareId}`,
      },
    };
  } catch {
    // A transient Firestore failure must not throw an unstyled 500 on a public
    // page — fall back to a generic title; the page body handles the data.
    return { title: 'MODUS — Shared conversation' };
  }
}

export default async function SharedConversationPage({ params }: { params: { shareId: string } }) {
  // Treat a backend/transient failure like a missing doc rather than crashing
  // this public marketing surface with an unstyled 500.
  const snap = await adminDb
    .collection('sharedConversations')
    .doc(params.shareId)
    .get()
    .catch(() => null);
  if (!snap || !snap.exists) notFound();

  const data = snap.data() as SharedConversation;
  const messages = (data.messages ?? []).filter(m => m.role !== 'system');

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-tight text-text">MODUS</span>
          <span className="text-border">·</span>
          <span className="text-sm text-muted truncate max-w-xs">{data.title}</span>
        </div>
        <a
          href="https://moduspilot.com"
          className="text-xs font-medium text-brand hover:underline"
        >
          Try MODUS →
        </a>
      </header>

      {/* Messages */}
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <h1 className="text-xl font-semibold text-text mb-8">{data.title}</h1>

        {messages.length === 0 && (
          <p className="text-muted text-sm text-center py-12">This conversation has no messages.</p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === 'user'
                  ? 'bg-brand text-white rounded-br-sm'
                  : 'bg-panel border border-border text-text rounded-bl-sm'
              }`}
            >
              {msg.role === 'assistant' && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1.5">MODUS</p>
              )}
              {msg.content}
            </div>
          </div>
        ))}
      </main>

      {/* CTA footer */}
      <footer className="border-t border-border mt-16 py-10 text-center px-4">
        <p className="text-sm text-muted mb-4">This conversation was shared from MODUS — your AI chief of staff.</p>
        <a
          href="https://moduspilot.com"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand/90 transition-colors"
        >
          Get MODUS free
        </a>
      </footer>
    </div>
  );
}
