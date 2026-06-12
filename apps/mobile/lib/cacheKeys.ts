// Canonical cache key functions — one key per collection per user.
// All screens and hooks must use these so the in-memory and AsyncStorage
// caches stay consistent (e.g. goals.tsx and dashboard both write/read
// the same key rather than separate "goals.uid" vs "dash.goals.uid" keys).

export const CK = {
  goals:    (uid: string) => `goals.${uid}`,
  tasks:    (uid: string) => `tasks.${uid}`,
  habits:   (uid: string) => `habits.${uid}`,
  projects: (uid: string) => `projects.${uid}`,
  briefing: (uid: string) => `briefing.${uid}`,
  events:   (uid: string) => `events.${uid}`,
  inbox:    (uid: string) => `inbox.${uid}`,
} as const;
