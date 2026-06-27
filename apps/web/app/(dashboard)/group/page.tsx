'use client';

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where, updateDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';

interface Member {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: 'owner' | 'member';
  sharing?: { availability?: boolean };
}
interface Invite {
  id: string;
  groupId: string;
  groupName: string;
  email: string;
  invitedByName: string | null;
  status: string;
}

async function callGroup(path: string, body?: unknown) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`/api/group/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
  return data;
}

export default function GroupPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const email = user?.email?.toLowerCase() ?? null;

  const [groupId, setGroupId] = useState<string | null | undefined>(undefined); // undefined = loading
  const [plan, setPlan] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [myInvites, setMyInvites] = useState<Invite[]>([]);
  const [sentInvites, setSentInvites] = useState<Invite[]>([]);

  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Watch which group (if any) the user belongs to.
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid), snap => {
      const d = snap.data();
      setGroupId((d?.groupId as string | undefined) ?? null);
      setPlan((d?.plan as string | undefined) ?? 'free');
    });
  }, [uid]);

  // Group doc + members.
  useEffect(() => {
    if (!groupId) { setMembers([]); setOwnerUid(null); return; }
    const unsubGroup = onSnapshot(doc(db, 'groups', groupId), snap => {
      const d = snap.data();
      setGroupName((d?.name as string) ?? 'Group');
      setOwnerUid((d?.ownerUid as string) ?? null);
    });
    const unsubMembers = onSnapshot(collection(db, 'groups', groupId, 'members'), snap => {
      setMembers(snap.docs.map(d => ({ uid: d.id, ...(d.data() as Omit<Member, 'uid'>) })));
    });
    return () => { unsubGroup(); unsubMembers(); };
  }, [groupId]);

  // Invites addressed to me (single equality filter — no composite index).
  useEffect(() => {
    if (!email) return;
    return onSnapshot(query(collection(db, 'groupInvites'), where('email', '==', email)), snap => {
      setMyInvites(snap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<Invite, 'id'>) }))
        .filter(i => i.status === 'pending'));
    });
  }, [email]);

  // Invites I've sent (owner view).
  useEffect(() => {
    if (!uid || !groupId) { setSentInvites([]); return; }
    return onSnapshot(query(collection(db, 'groupInvites'), where('invitedByUid', '==', uid)), snap => {
      setSentInvites(snap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<Invite, 'id'>) }))
        .filter(i => i.status === 'pending'));
    });
  }, [uid, groupId]);

  const isOwner = ownerUid === uid;
  const me = members.find(m => m.uid === uid);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setBusy(false); }
  }

  const createGroup = () => run(async () => { await callGroup('create', { name: nameInput }); setNameInput(''); });
  const upgrade = () => run(async () => {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan: 'group' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error ?? 'Could not start checkout');
    window.location.href = data.url;
  });
  const invite = () => run(async () => { await callGroup('invite', { email: emailInput }); setEmailInput(''); setNotice('Invite sent.'); });
  const accept = (inviteId: string) => run(async () => { await callGroup('accept', { inviteId }); });
  const leave = () => run(async () => { await callGroup('leave'); });
  const disband = () => run(async () => { await callGroup('delete'); });

  async function toggleSharing(next: boolean) {
    if (!groupId || !uid) return;
    try {
      await updateDoc(doc(db, 'groups', groupId, 'members', uid), { 'sharing.availability': next });
    } catch { setError('Could not update sharing'); }
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="px-4 md:px-8 pt-6 md:pt-8 pb-6 border-b border-border/50">
        <h1 className="text-2xl font-medium text-text">Group</h1>
        <p className="text-muted text-sm mt-0.5">A private MODUS for each person, together where it counts.</p>
      </div>

      <div className="p-4 md:p-8 max-w-2xl space-y-5">
        {error && <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{error}</div>}
        {notice && <div className="text-sm text-brand bg-brand/10 border border-brand/20 rounded-xl px-4 py-2.5">{notice}</div>}

        {/* Pending invites addressed to me */}
        {myInvites.length > 0 && !groupId && myInvites.map(inv => (
          <motion.div key={inv.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-panel border border-brand/30 rounded-2xl p-5">
            <p className="text-sm text-text">
              <span className="font-semibold">{inv.invitedByName ?? 'Someone'}</span> invited you to join{' '}
              <span className="font-semibold">{inv.groupName}</span>.
            </p>
            <button onClick={() => accept(inv.id)} disabled={busy}
              className="mt-3 px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
              Join group
            </button>
          </motion.div>
        ))}

        {groupId === undefined && <p className="text-sm text-muted">Loading…</p>}

        {/* No group, on the Group plan → create */}
        {groupId === null && plan === 'group' && (
          <div className="bg-panel border border-border rounded-2xl p-6">
            <h2 className="text-base font-semibold text-text mb-1">Start a group</h2>
            <p className="text-sm text-muted mb-4">Create a group, then invite up to 4 people. Each gets their own private MODUS.</p>
            <div className="flex gap-2">
              <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Group name (e.g. Acme founders)"
                className="flex-1 bg-bg border border-border rounded-xl px-3.5 py-2.5 text-sm text-text outline-none focus:border-brand/50" />
              <button onClick={createGroup} disabled={busy}
                className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50 shrink-0">
                Create
              </button>
            </div>
          </div>
        )}

        {/* No group, not on the Group plan → upgrade (invitees with a pending invite see the accept card above instead) */}
        {groupId === null && plan !== 'group' && myInvites.length === 0 && (
          <div className="bg-panel border border-brand rounded-2xl p-6 shadow-[0_0_40px_rgba(124,58,237,0.10)]">
            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">GROUP — $79/mo</p>
            <h2 className="text-lg font-semibold text-text mb-1">A private MODUS for your whole group.</h2>
            <p className="text-sm text-muted mb-4">You plus 4 members, each with their own MODUS. Agent-to-agent coordination, a shared group space, and everything in MODUS for each person.</p>
            <button onClick={upgrade} disabled={busy}
              className="px-5 py-3 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand/90 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all disabled:opacity-50">
              Upgrade to Group
            </button>
          </div>
        )}

        {/* In a group */}
        {groupId && (
          <>
            <div className="bg-panel border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
                <span className="text-base font-semibold text-text">{groupName}</span>
                <span className="text-[11px] text-muted">{members.length} / 5</span>
              </div>
              <ul className="divide-y divide-border/40">
                {members.map(m => (
                  <li key={m.uid} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand/15 flex items-center justify-center text-brand text-xs font-semibold shrink-0">
                      {(m.displayName || m.email || '?')[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text truncate">{m.displayName || m.email}{m.uid === uid && ' (you)'}</p>
                      {m.email && <p className="text-[11px] text-muted truncate">{m.email}</p>}
                    </div>
                    {m.role === 'owner' && <span className="text-[10px] font-semibold uppercase tracking-wider text-brand bg-brand/10 rounded px-1.5 py-0.5">Owner</span>}
                  </li>
                ))}
              </ul>
            </div>

            {/* My sharing preference */}
            <div className="bg-panel border border-border rounded-2xl p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-text">Share my availability</p>
                <p className="text-[12px] text-muted mt-0.5">Lets the group ask your MODUS when you’re free. Nothing else is shared.</p>
              </div>
              <button
                onClick={() => toggleSharing(!(me?.sharing?.availability ?? false))}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${me?.sharing?.availability ? 'bg-brand' : 'bg-border'}`}
                aria-label="Toggle availability sharing"
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${me?.sharing?.availability ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {/* Invite (owner only) */}
            {isOwner && members.length < 5 && (
              <div className="bg-panel border border-border rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-text mb-3">Invite someone</h2>
                <div className="flex gap-2">
                  <input value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="their@email.com" type="email"
                    className="flex-1 bg-bg border border-border rounded-xl px-3.5 py-2.5 text-sm text-text outline-none focus:border-brand/50" />
                  <button onClick={invite} disabled={busy}
                    className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50 shrink-0">
                    Invite
                  </button>
                </div>
                {sentInvites.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {sentInvites.map(inv => (
                      <li key={inv.id} className="text-[12px] text-muted flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> {inv.email} — pending
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Leave / disband */}
            <div className="pt-2">
              {isOwner ? (
                <button onClick={disband} disabled={busy} className="text-sm text-red-500 hover:text-red-600 transition-colors">
                  Disband group
                </button>
              ) : (
                <button onClick={leave} disabled={busy} className="text-sm text-red-500 hover:text-red-600 transition-colors">
                  Leave group
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
