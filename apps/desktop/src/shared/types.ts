export interface SignedInUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

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
