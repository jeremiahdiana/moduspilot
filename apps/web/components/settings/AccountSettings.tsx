'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfile, deleteUser } from 'firebase/auth';
import { doc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { User } from 'firebase/auth';

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
  const router = useRouter();

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
