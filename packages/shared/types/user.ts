export interface ModusUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  plan: 'free' | 'pro';
  stripeCustomerId?: string;
  subscriptionId?: string;
  createdAt: Date;
}
