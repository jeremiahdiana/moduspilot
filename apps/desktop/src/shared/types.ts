export interface NoteRecord {
  id: string;
  title: string;
  body: string;
  folder?: string;
  source: string;
  // Epoch ms of the note's actual last-edit time (e.g. Apple Notes
  // ZMODIFICATIONDATE1) — distinct from Firestore's updatedAt (sync time).
  // A bulk sync writes many notes within the same instant, so updatedAt
  // alone can't be used to find the most recently *edited* notes.
  modifiedAt?: number;
}

// One per iMessage conversation (thread), not per individual message — body
// is a recent-messages transcript. Same modifiedAt rationale as NoteRecord.
export interface ConversationRecord {
  id: string;
  title: string;
  body: string;
  source: string;
  modifiedAt?: number;
}

// One per Apple Reminder — synced into the MODUS reminders section as a task.
// `completed` lets the backend reconcile MODUS task state with Apple's.
export interface ReminderRecord {
  id: string;               // ZIDENTIFIER (stable UUID)
  title: string;
  notes?: string;
  dueDate?: string;         // YYYY-MM-DD in the user's local timezone (matches MODUS Task.dueDate)
  completed: boolean;
  priority?: 'high' | 'medium' | 'low';
  list?: string;
}
