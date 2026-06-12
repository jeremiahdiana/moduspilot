// Shared domain types — single source of truth for all screens and hooks.
// All Firestore collection shapes are defined here; screens import from this file.

export interface Goal {
  id: string;
  title: string;
  progress: number;
  dueDate?: string;
  status: string;
  description?: string;
  deleted?: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  done: boolean;
  deleted?: boolean;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
  projectId?: string;
}

export interface Habit {
  id: string;
  title: string;
  description?: string;
  streak: number;
  completedDates: string[];
  frequency: 'daily' | 'weekly';
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  status: string;
}

export type Plan = 'free' | 'modus' | 'pilot' | null;
