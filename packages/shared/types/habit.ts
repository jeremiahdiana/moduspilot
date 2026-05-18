export interface Habit {
  id: string;
  title: string;
  frequency: 'daily' | 'weekly';
  streak: number;
  lastCompletedAt?: Date;
  source?: 'manual' | 'modus_ai';
  createdAt: Date;
}
