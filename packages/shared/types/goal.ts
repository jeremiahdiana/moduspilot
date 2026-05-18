export interface Goal {
  id: string;
  title: string;
  description?: string;
  targetDate?: Date;
  progress: number;
  status: 'active' | 'completed' | 'archived';
  source?: 'manual' | 'modus_ai';
  createdAt: Date;
}
