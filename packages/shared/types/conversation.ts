export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  title?: string;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
  /**
   * The model this thread is set to ('auto' | a platform model id | 'default').
   * A per-thread switch persists here so it survives reload; absent means the
   * thread still follows the account default.
   */
  modelChoice?: string;
}
