import {
  doc, collection, onSnapshot, query, where, updateDoc, addDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { API_BASE, getAuthHeader } from './api';

// Mobile mirror of the web /group feature — same Firestore collections and the
// same /api/group/* Admin-SDK routes, so web and iOS operate on one data model.

export interface GroupMember {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: 'owner' | 'member';
  sharing?: { availability?: boolean };
}
export interface GroupInvite {
  id: string;
  groupId: string;
  groupName: string;
  email: string;
  invitedByName: string | null;
  status: string;
}
export interface SharedItem {
  id: string;
  text: string;
  authorUid: string;
  authorName: string | null;
  createdAtMs: number;
}

export function currentUid(): string | null { return auth.currentUser?.uid ?? null; }
export function currentEmail(): string | null { return auth.currentUser?.email?.toLowerCase() ?? null; }
export function currentName(): string | null { return auth.currentUser?.displayName ?? null; }

export async function callGroup(path: string, body?: unknown) {
  const res = await fetch(`${API_BASE}/api/group/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
  return data;
}

export function subscribeUserGroup(uid: string, cb: (groupId: string | null, plan: string) => void) {
  return onSnapshot(doc(db, 'users', uid), snap => {
    const d = snap.data();
    cb((d?.groupId as string | undefined) ?? null, (d?.plan as string | undefined) ?? 'free');
  });
}
export function subscribeGroup(groupId: string, cb: (g: { name: string; ownerUid: string | null }) => void) {
  return onSnapshot(doc(db, 'groups', groupId), snap => {
    const d = snap.data();
    cb({ name: (d?.name as string) ?? 'Group', ownerUid: (d?.ownerUid as string) ?? null });
  });
}
export function subscribeMembers(groupId: string, cb: (m: GroupMember[]) => void) {
  return onSnapshot(collection(db, 'groups', groupId, 'members'), snap => {
    cb(snap.docs.map(d => ({ uid: d.id, ...(d.data() as Omit<GroupMember, 'uid'>) })));
  });
}
export function subscribeMyInvites(email: string, cb: (i: GroupInvite[]) => void) {
  return onSnapshot(query(collection(db, 'groupInvites'), where('email', '==', email)), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<GroupInvite, 'id'>) })).filter(i => i.status === 'pending'));
  });
}
export function subscribeSentInvites(uid: string, cb: (i: GroupInvite[]) => void) {
  return onSnapshot(query(collection(db, 'groupInvites'), where('invitedByUid', '==', uid)), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<GroupInvite, 'id'>) })).filter(i => i.status === 'pending'));
  });
}
export function subscribeShared(groupId: string, cb: (s: SharedItem[]) => void) {
  return onSnapshot(collection(db, 'groups', groupId, 'shared'), snap => {
    cb(snap.docs.map(d => {
      const x = d.data();
      return {
        id: d.id,
        text: x.text as string,
        authorUid: x.authorUid as string,
        authorName: (x.authorName as string) ?? null,
        createdAtMs: x.createdAt?.toMillis?.() ?? 0,
      };
    }).sort((a, b) => b.createdAtMs - a.createdAtMs));
  });
}
export async function setAvailabilitySharing(groupId: string, uid: string, next: boolean) {
  await updateDoc(doc(db, 'groups', groupId, 'members', uid), { 'sharing.availability': next });
}
export async function addSharedItem(groupId: string, uid: string, name: string | null, text: string) {
  await addDoc(collection(db, 'groups', groupId, 'shared'), {
    text, authorUid: uid, authorName: name, createdAt: serverTimestamp(),
  });
}
export async function removeSharedItem(groupId: string, id: string) {
  await deleteDoc(doc(db, 'groups', groupId, 'shared', id));
}
