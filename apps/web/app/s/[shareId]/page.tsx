import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { adminDb } from '@/lib/firebase-admin';
import MarkdownMessage from '@/components/chat/MarkdownMessage';
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
      description: 'A conversation from MODUS, the AI operating system that runs your day.',
      openGraph: {
        title: `${data.title} — MODUS`,
        description: 'A conversation from MODUS, the AI operating system that runs your day.',
        url: `https://moduspilot.com/s/${params.shareId}`,
        siteName: 'MODUS',
        images: ['/og.png'],
        type: 'article',
      },
      twitter: { card: 'summary_large_image', title: `${data.title} — MODUS`, images: ['/og.png'] },
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

function Logo() {
  return (
    <Link href="https://moduspilot.com" className="flex items-center gap-1.5 shrink-0">
      <Image src="/logo.png" alt="MODUS" width={46} height={36} priority className="object-contain block dark:hidden" />
      <Image src="/logo-dark.png" alt="MODUS" width={46} height={36} priority className="object-contain hidden dark:block" />
      <span className="text-sm font-black tracking-widest text-brand">MODUS</span>
    </Link>
  );
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
  const shared = data.createdAt?.toDate?.();

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      {/* Header — matches the marketing nav so a shared link feels like the product */}
      <header className="sticky top-0 z-20 border-b border-border/70 bg-bg/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <Logo />
          <Link
            href="https://moduspilot.com"
            className="text-xs font-semibold text-muted hover:text-text transition-colors"
          >
            Try MODUS free →
          </Link>
        </div>
      </header>

      {/* Conversation */}
      <main className="w-full max-w-3xl mx-auto px-5 py-12 flex-1">
        <div className="mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand/80 mb-2">Shared conversation</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text text-balance">{data.title}</h1>
          {shared && (
            <p className="text-xs text-muted mt-2.5">
              {shared.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>

        {messages.length === 0 && (
          <p className="text-muted text-sm text-center py-16">This conversation has no messages.</p>
        )}

        <div className="space-y-6">
          {messages.map((msg) =>
            msg.role === 'user' ? (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand text-white px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={msg.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-brand/12 text-brand text-[9px] font-black tracking-wider">M</span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">MODUS</span>
                </div>
                <div className="rounded-2xl rounded-tl-md border border-border bg-panel px-4 py-3">
                  <MarkdownMessage>{msg.content}</MarkdownMessage>
                </div>
              </div>
            )
          )}
        </div>
      </main>

      {/* CTA — premium, honest (3-day trial, not "free"), with the sweep-shine button */}
      <footer className="border-t border-border mt-12">
        <div className="max-w-3xl mx-auto px-5 py-16 text-center">
          <div className="flex justify-center mb-5">
            <Image src="/logo.png" alt="MODUS" width={40} height={32} className="object-contain block dark:hidden" />
            <Image src="/logo-dark.png" alt="MODUS" width={40} height={32} className="object-contain hidden dark:block" />
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text text-balance">
            One system for goals, tasks, inbox and calendar.
          </h2>
          <p className="text-sm text-muted mt-3 max-w-md mx-auto leading-relaxed">
            MODUS is the AI operating system that runs your day — and executes, not just chats. This is a glimpse of what it does.
          </p>
          <Link
            href="https://moduspilot.com"
            className="btn-primary inline-flex items-center gap-2 mt-7 px-6 py-3 rounded-xl text-white text-sm font-semibold"
          >
            <span className="relative z-10">Start free, no card</span>
          </Link>
          <p className="text-[11px] text-muted mt-3">10 messages on every frontier model, no card. Then a 3-day trial.</p>
        </div>
      </footer>
    </div>
  );
}
