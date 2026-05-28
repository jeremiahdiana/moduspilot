'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfile, deleteUser } from 'firebase/auth';
import { doc, deleteDoc, collection, getDocs, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import { FREE_DAILY_LIMIT, TRIAL_DAYS } from '@/lib/constants';

interface Props {
  user: User;
}

export default function AccountSettings({ user }: Props) {
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState('');
  const [msgCount, setMsgCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [plan, setPlan] = useState<'free' | 'modus' | 'pilot'>('free');
  const [trialDaysLeft, setTrialDaysLeft] = useState(TRIAL_DAYS);
  const router = useRouter();

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (user.metadata.creationTime) {
      const days = Math.floor((Date.now() - new Date(user.metadata.creationTime).getTime()) / 86400000);
      setTrialDaysLeft(Math.max(0, TRIAL_DAYS - days));
    }
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      const data = snap.data() ?? {};
      setPlan(data.plan === 'modus' || data.plan === 'pilot' ? data.plan : 'free');
      setMsgCount(data.usageDate === today ? (data.dailyMessages ?? 0) : 0);
    }).catch(() => {});
  }, [user]);

  const handleSaveName = async () => {
    setNameSaving(true);
    setError('');
    try {
      await updateProfile(user, { displayName });
      setNameSaved(true);
      timerRef.current = setTimeout(() => setNameSaved(false), 2000);
    } catch {
      setError('Failed to update name.');
    } finally {
      setNameSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteInput !== 'DELETE') return;
    setDeleting(true);
    setError('');
    try {
      const subcols = ['conversations', 'goals', 'tasks', 'habits', 'memories', 'google_accounts', 'integrations'];
      for (const sub of subcols) {
        const snap = await getDocs(collection(db, 'users', user.uid, sub));
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      }
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(user);
      setDeleted(true);
      timerRef.current = setTimeout(() => router.push('/login'), 2500);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('requires-recent-login')) {
        setError('Please sign out and sign back in, then try again.');
      } else {
        setError('Failed to delete account. Please try again.');
      }
      setDeleting(false);
    }
  };

  const providers = user.providerData.map(p => p.providerId);
  const providerLabels: Record<string, string> = {
    'google.com': 'Google',
    'apple.com': 'Apple',
    'password': 'Email / Password',
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Account</h2>
        <p className="text-sm text-muted">Manage your profile and login settings.</p>
      </div>

      {/* Usage */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-text">Plan & Usage</h3>
        {plan === 'free' ? (
          <>
            {trialDaysLeft > 0 ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">Free trial</p>
                <span className="text-xs font-semibold text-brand bg-brand/10 px-2.5 py-1 rounded-full">{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} left</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted">Messages today</p>
                  <span className="text-xs text-muted">{msgCount} / {FREE_DAILY_LIMIT}</span>
                </div>
                <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${msgCount >= FREE_DAILY_LIMIT ? 'bg-red-400' : 'bg-brand'}`}
                    style={{ width: `${Math.min(100, (msgCount / FREE_DAILY_LIMIT) * 100)}%` }}
                  />
                </div>
                {msgCount >= FREE_DAILY_LIMIT && (
                  <p className="text-xs text-red-400">Daily limit reached. Resets at midnight.</p>
                )}
              </div>
            )}
            <p className="text-xs text-muted">Free plan · <span className="text-brand cursor-pointer hover:underline">Upgrade to remove limits →</span></p>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-text font-medium capitalize">{plan} plan</p>
            <span className="text-xs font-semibold text-brand bg-brand/10 px-2.5 py-1 rounded-full">Unlimited</span>
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-5">
        <h3 className="text-sm font-semibold text-text">Profile</h3>

        <div className="flex items-center gap-4">
          {user.photoURL && (
            <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full border border-border" />
          )}
          <div>
            <p className="text-sm font-medium text-text">{user.displayName || 'No name set'}</p>
            <p className="text-xs text-muted">{user.email}</p>
            {user.metadata.creationTime && (
              <p className="text-xs text-muted/60 mt-0.5">
                Member since {new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-muted font-medium">Display Name</label>
          <div className="flex gap-3">
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="flex-1 bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-brand/50 transition-colors"
              placeholder="Your name"
            />
            <button
              onClick={handleSaveName}
              disabled={nameSaving || !displayName.trim()}
              className="px-4 py-2 bg-brand text-white text-sm rounded-lg font-medium disabled:opacity-40 hover:bg-brand/90 transition-colors min-w-[80px] flex items-center justify-center gap-1.5"
            >
              {nameSaved ? (
                <>
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                  Saved
                </>
              ) : nameSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-muted font-medium">Email</label>
          <input
            value={user.email ?? ''}
            disabled
            className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-muted opacity-60 cursor-not-allowed"
          />
        </div>
      </div>

      {/* Linked accounts */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-text">Linked Accounts</h3>
        <div className="space-y-2">
          {providers.map(pid => (
            <div key={pid} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-bg border border-border">
              <span className="text-sm text-text">{providerLabels[pid] ?? pid}</span>
              <span className="text-xs text-brand font-medium">Connected</span>
            </div>
          ))}
          {providers.length === 0 && (
            <p className="text-xs text-muted">No linked accounts.</p>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-panel border border-red-900/40 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
        {!showDeleteConfirm ? (
          <>
            <p className="text-xs text-muted">Permanently delete your account, all conversations, goals, habits, tasks, and memories. This cannot be undone.</p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 border border-red-800/60 text-red-400 text-sm rounded-lg hover:bg-red-900/20 transition-colors"
            >
              Delete Account
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted">Type <span className="font-mono text-red-400 font-semibold">DELETE</span> to confirm:</p>
            <input
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              className="w-full bg-bg border border-red-800/40 rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none"
              placeholder="DELETE"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                className="px-4 py-2 bg-panel border border-border text-muted text-sm rounded-lg hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteInput !== 'DELETE' || deleting}
                className="px-4 py-2 bg-red-900/40 border border-red-800/60 text-red-400 text-sm rounded-lg disabled:opacity-40 hover:bg-red-900/60 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        {deleted && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald-400 shrink-0">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <p className="text-sm text-emerald-400 font-medium">Account successfully deleted. Signing you out…</p>
          </div>
        )}
      </div>
    </div>
  );
}
