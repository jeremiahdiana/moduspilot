'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { updateProfile, deleteUser } from 'firebase/auth';
import { doc, deleteDoc, collection, getDocs, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { User } from 'firebase/auth';

const FREE_DAILY_LIMIT = 20;
const TRIAL_DAYS = 4;

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
  const [error, setError] = useState('');
  const [msgCount, setMsgCount] = useState(0);
  const [plan, setPlan] = useState<'free' | 'modus' | 'pilot'>('free');
  const [trialDaysLeft, setTrialDaysLeft] = useState(TRIAL_DAYS);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

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

    // Check Google integration status
    getDoc(doc(db, 'users', user.uid, 'integrations', 'google')).then(snap => {
      if (snap.exists()) {
        setGoogleConnected(true);
        setGoogleEmail(snap.data()?.email ?? '');
      }
    }).catch(() => {});
  }, [user]);

  // Handle OAuth callback params
  useEffect(() => {
    if (searchParams.get('connected') === 'google') {
      setGoogleConnected(true);
      router.replace('/settings');
    }
  }, [searchParams, router]);

  async function handleConnectGoogle() {
    setConnectingGoogle(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/auth/google/connect', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      setConnectingGoogle(false);
    }
  }

  async function handleDisconnectGoogle() {
    setDisconnectingGoogle(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch('/api/auth/google/disconnect', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setGoogleConnected(false);
      setGoogleEmail('');
    } catch {}
    setDisconnectingGoogle(false);
  }

  const handleSaveName = async () => {
    setNameSaving(true);
    setError('');
    try {
      await updateProfile(user, { displayName });
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (e) {
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
      // Delete all Firestore subcollections we know about
      const subcols = ['conversations', 'goals', 'tasks', 'habits', 'memories'];
      for (const sub of subcols) {
        const snap = await getDocs(collection(db, 'users', user.uid, sub));
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      }
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(user);
      router.push('/login');
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
              className="px-4 py-2 bg-brand text-white text-sm rounded-lg font-medium disabled:opacity-40 hover:bg-brand/90 transition-colors min-w-[80px]"
            >
              {nameSaved ? '✓ Saved' : nameSaving ? 'Saving…' : 'Save'}
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

      {/* Integrations */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text">Integrations</h3>
          <p className="text-xs text-muted mt-0.5">Connect your tools so MODUS can see your full day.</p>
        </div>
        <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-bg border border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-text">Google Calendar + Gmail</p>
              {googleConnected && googleEmail
                ? <p className="text-xs text-muted">{googleEmail}</p>
                : <p className="text-xs text-muted">Calendar events and email in your briefing</p>
              }
            </div>
          </div>
          {googleConnected ? (
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-emerald-500">Connected</span>
              <button
                onClick={handleDisconnectGoogle}
                disabled={disconnectingGoogle}
                className="text-xs text-muted hover:text-red-400 transition-colors disabled:opacity-40"
              >
                {disconnectingGoogle ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectGoogle}
              disabled={connectingGoogle}
              className="text-xs px-3 py-1.5 rounded-lg border border-brand/40 bg-brand/5 text-brand hover:bg-brand/10 transition-colors disabled:opacity-40 cursor-pointer"
            >
              {connectingGoogle ? 'Redirecting…' : 'Connect'}
            </button>
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
      </div>
    </div>
  );
}
