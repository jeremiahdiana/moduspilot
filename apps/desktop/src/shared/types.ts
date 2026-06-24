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
}
