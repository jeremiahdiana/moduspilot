'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { SkeletonList, SkeletonRow } from '@/components/ui/Skeleton';

interface Note {
  id: string;
  title: string;
  body: string;
  folder?: string | null;
  source?: string;
  modifiedAt?: Date | null;
}

function relativeDate(d?: Date | null): string {
  if (!d) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotesPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(
      collection(db, 'users', user.uid, 'notes'),
      orderBy('modifiedAt', 'desc'),
      limit(300),
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setNotes(snap.docs.map(d => {
          const x = d.data();
          return {
            id: d.id,
            title: (x.title as string) ?? 'Untitled',
            body: (x.body as string) ?? '',
            folder: (x.folder as string) ?? null,
            source: x.source as string,
            modifiedAt: x.modifiedAt?.toDate?.() ?? null,
          };
        }));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [user]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return notes;
    return notes.filter(n =>
      n.title.toLowerCase().includes(s) || n.body.toLowerCase().includes(s)
    );
  }, [notes, search]);

  return (
    <div className="p-8 overflow-y-auto h-full">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6 max-w-2xl"
      >
        <h1 className="text-2xl font-bold text-text">Notes</h1>
        <p className="text-muted text-sm mt-0.5">Your Apple Notes, synced from the MODUS Desktop app.</p>
      </motion.div>

      {loading ? (
        <SkeletonList count={6} className="max-w-2xl space-y-3"><SkeletonRow /></SkeletonList>
      ) : notes.length === 0 ? (
        <div className="max-w-2xl py-12 text-center">
          <p className="text-muted text-sm">No notes synced yet.</p>
          <p className="text-muted text-xs mt-1">Open the MODUS Desktop app (Mac) and grant Full Disk Access to sync your Apple Notes.</p>
        </div>
      ) : (
        <div className="max-w-2xl space-y-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${notes.length} notes…`}
            className="w-full bg-panel border border-border rounded-lg px-3.5 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:border-brand/50 transition-colors"
          />

          {filtered.length === 0 ? (
            <p className="text-muted text-sm py-6 text-center">No notes match “{search}”.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(n => {
                const open = openId === n.id;
                return (
                  <div key={n.id} className="bg-panel border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => setOpenId(open ? null : n.id)}
                      className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-bg/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-text truncate">{n.title}</p>
                          {n.folder && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-border/60 text-muted shrink-0">{n.folder}</span>
                          )}
                        </div>
                        {!open && (
                          <p className="text-xs text-muted mt-0.5 line-clamp-1">{n.body.replace(/\n/g, ' ').slice(0, 140)}</p>
                        )}
                      </div>
                      <span className="text-[11px] text-muted shrink-0 mt-0.5">{relativeDate(n.modifiedAt)}</span>
                    </button>
                    {open && (
                      <div className="px-4 pb-4 -mt-1">
                        <p className="text-sm text-text/90 whitespace-pre-wrap leading-relaxed border-t border-border pt-3">{n.body}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
