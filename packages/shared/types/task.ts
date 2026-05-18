export interface Task {
  id: string;
  title: string;
  notes?: string;
  dueDate?: Date;
  completed: boolean;
  goalId?: string;
  source?: 'manual' | 'modus_ai';
  createdAt: Date;
}
