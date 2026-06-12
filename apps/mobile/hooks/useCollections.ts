// Typed Firestore collection hooks with dual-layer caching.
//
// Each hook encapsulates the cache-warm → onSnapshot → writeCache pattern
// that was previously duplicated across goals, tasks, habits, and projects
// screens. Screens import the hook and get { data, loading } directly.

import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, query, orderBy,
  type QueryDocumentSnapshot, type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { readCache, readCacheSync, writeCache } from '@/lib/cache';
import { CK } from '@/lib/cacheKeys';
import type { Goal, Task, Habit, Project } from '@/lib/types';

// ── Generic core ─────────────────────────────────────────────────────────────

function useCollection<T>(
  uid: string | undefined,
  cacheKey: string,
  collPath: string,
  transform: (docs: QueryDocumentSnapshot<DocumentData>[]) => T[],
): { data: T[]; loading: boolean } {
  const [data, setData] = useState<T[]>(() => (uid ? readCacheSync<T[]>(cacheKey) ?? [] : []));
  const [loading, setLoading] = useState(() => !uid || !readCacheSync(cacheKey));

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    let alive = true;

    readCache<T[]>(cacheKey).then(cached => {
      if (alive && cached && cached.length > 0) { setData(cached); setLoading(false); }
    });

    const unsub = onSnapshot(
      query(collection(db, collPath), orderBy('createdAt', 'desc')),
      snap => {
        const next = transform(snap.docs);
        if (alive) { setData(next); setLoading(false); }
        writeCache(cacheKey, next);
      },
      () => { if (alive) setLoading(false); },
    );

    return () => { alive = false; unsub(); };
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading };
}

// ── Typed hooks ───────────────────────────────────────────────────────────────

export function useGoals(uid: string | undefined) {
  return useCollection<Goal>(
    uid,
    uid ? CK.goals(uid) : '',
    uid ? `users/${uid}/goals` : '',
    docs => docs
      .map(d => ({
        id: d.id,
        title: d.data().title ?? 'Untitled',
        progress: d.data().progress ?? 0,
        dueDate: d.data().dueDate,
        status: d.data().status ?? 'active',
        description: d.data().description,
        deleted: d.data().deleted,
      }))
      .filter(g => g.status === 'active' && !g.deleted),
  );
}

export function useTasks(uid: string | undefined) {
  return useCollection<Task>(
    uid,
    uid ? CK.tasks(uid) : '',
    uid ? `users/${uid}/tasks` : '',
    docs => docs
      .map(d => ({
        id: d.id,
        title: d.data().title ?? 'Untitled',
        description: d.data().description,
        done: d.data().done ?? false,
        deleted: d.data().deleted ?? false,
        dueDate: d.data().dueDate,
        priority: d.data().priority as Task['priority'],
        projectId: d.data().projectId,
      }))
      .filter(t => !t.deleted),
  );
}

export function useHabits(uid: string | undefined) {
  return useCollection<Habit>(
    uid,
    uid ? CK.habits(uid) : '',
    uid ? `users/${uid}/habits` : '',
    docs => docs.map(d => ({
      id: d.id,
      title: d.data().title ?? 'Untitled',
      description: d.data().description,
      streak: d.data().streak ?? 0,
      completedDates: d.data().completedDates ?? [],
      frequency: (d.data().frequency ?? 'daily') as Habit['frequency'],
    })),
  );
}

export function useProjects(uid: string | undefined) {
  return useCollection<Project>(
    uid,
    uid ? CK.projects(uid) : '',
    uid ? `users/${uid}/projects` : '',
    docs => docs
      .map(d => ({
        id: d.id,
        title: d.data().title ?? 'Untitled',
        description: d.data().description,
        status: d.data().status ?? 'active',
      }))
      .filter(p => p.status === 'active'),
  );
}
