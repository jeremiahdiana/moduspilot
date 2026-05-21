'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardWidget {
  id: string;
  type: 'goals' | 'habits' | 'tasks' | 'briefing' | 'quick_chat' | 'gmail' | 'calendar' | 'notes' | 'finance';
  title: string;
  layout?: WidgetLayout;
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'goals',  type: 'goals',  title: 'Goals',   layout: { x: 0, y: 0, w: 6, h: 5 } },
  { id: 'habits', type: 'habits', title: 'Habits',  layout: { x: 6, y: 0, w: 6, h: 5 } },
  { id: 'tasks',  type: 'tasks',  title: 'Tasks',   layout: { x: 0, y: 5, w: 6, h: 6 } },
];

async function persist(uid: string, widgets: DashboardWidget[]) {
  await setDoc(doc(db, 'users', uid), { dashboardWidgets: widgets }, { merge: true });
}

export function useDashboard(uid: string | null) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setWidgets([]);
    setLoading(true);
    if (!uid) { setLoading(false); return; }
    getDoc(doc(db, 'users', uid)).then(snap => {
      const saved = snap.data()?.dashboardWidgets as DashboardWidget[] | undefined;
      setWidgets(saved?.length ? saved : DEFAULT_WIDGETS);
      setLoading(false);
    }).catch(() => { setWidgets(DEFAULT_WIDGETS); setLoading(false); });
  }, [uid]);

  const updateLayout = useCallback((layouts: { i: string; x: number; y: number; w: number; h: number }[]) => {
    if (!uid) return;
    setWidgets(prev => {
      const next = prev.map(w => {
        const l = layouts.find(nl => nl.i === w.id);
        if (!l) return w;
        return { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h } };
      });
      persist(uid, next);
      return next;
    });
  }, [uid]);

  const addWidget = useCallback((widget: DashboardWidget) => {
    if (!uid) return;
    setWidgets(prev => {
      // Place new widget after all existing ones
      const maxY = prev.reduce((m, w) => Math.max(m, (w.layout?.y ?? 0) + (w.layout?.h ?? 5)), 0);
      const withLayout: DashboardWidget = {
        ...widget,
        layout: widget.layout ?? { x: 0, y: maxY, w: 6, h: 5 },
      };
      const next = [...prev, withLayout];
      persist(uid, next);
      return next;
    });
  }, [uid]);

  const removeWidget = useCallback((id: string) => {
    if (!uid) return;
    setWidgets(prev => {
      const next = prev.filter(w => w.id !== id);
      persist(uid, next);
      return next;
    });
  }, [uid]);

  const renameWidget = useCallback((id: string, title: string) => {
    if (!uid) return;
    setWidgets(prev => {
      const next = prev.map(w => w.id === id ? { ...w, title } : w);
      persist(uid, next);
      return next;
    });
  }, [uid]);

  return { widgets, loading, updateLayout, addWidget, removeWidget, renameWidget };
}
