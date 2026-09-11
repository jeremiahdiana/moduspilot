/** Local-only rules regressions. See firebase.audit.json. */
import assert from 'node:assert/strict';
import { initializeApp as clientApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, setDoc, updateDoc, doc, deleteField, terminate, setLogLevel } from 'firebase/firestore';
import { initializeApp as adminApp } from 'firebase-admin/app';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:18080', 'Local audit emulator required');
const projectId = 'demo-modus-audit';
const admin = adminFirestore(adminApp({ projectId }));
const app = clientApp({ projectId, apiKey: 'demo-key' });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 18080, { mockUserToken: { sub: 'audit-user' } });
setLogLevel('silent');
let checks = 0;
const deny = async promise => { await assert.rejects(promise, error => error.code === 'permission-denied'); checks++; };
const allow = async promise => { await promise; checks++; };
const ref = doc(db, 'users/audit-user');
const adminRef = admin.doc('users/audit-user');
// Explicit fixtures, independent of the rules' protected-field list.
const protectedFields = [
  'plan', 'dailyMessages', 'usageDate', 'modusPilotSignupAt', 'dailyTokens', 'tokenDate',
  'weeklyTokens', 'tokenWeek', 'windowTokens', 'windowStart', 'limitAddonQty',
  'stripeCustomerId', 'subscriptionId', 'founding', 'groupId',
  'compareHour', 'compareCount', 'titleHour', 'titleCount',
  'goalSuggestHour', 'goalSuggestCount', 'goalPlanHour', 'goalPlanCount',
  'verdictHour', 'verdictCount', 'clarifyHour', 'clarifyCount',
  'mcpTestHour', 'mcpTestCount', 'importDate', 'importCount',
  'imageGenDate', 'imageGenCount', 'imageGenAt',
  'ttsCharsDate', 'ttsCharsToday', 'ttsCharsLifetime',
  'sttSecondsDate', 'sttSecondsToday', 'sttSecondsLifetime',
];
try {
  for (const field of protectedFields) {
    await adminRef.delete();
    await deny(setDoc(ref, { [field]: 'forged' }));
    await adminRef.set({ displayName: 'Original', [field]: 'server-value' });
    await deny(updateDoc(ref, { [field]: 'forged' }));
    await deny(updateDoc(ref, { [field]: deleteField() }));
  }
  await adminRef.delete();
  await allow(setDoc(ref, { displayName: 'Name', email: 'demo@example.com', onboardingComplete: false }));
  await adminRef.set({ plan: 'pilot', stripeCustomerId: 'cus_demo' }, { merge: true });
  await allow(setDoc(ref, { onboardingComplete: true, settings: { responseStyle: 'normal' }, dashboardWidgets: [] }, { merge: true }));
  await deny(setDoc(doc(db, 'users/someone-else'), { displayName: 'Forged' }));
  await allow(setDoc(doc(db, 'users/audit-user/tasks/task'), { title: 'Allowed task' }));
  await admin.doc('groups/audit-group').set({ memberUids: ['audit-user'] });
  await admin.doc('groups/audit-group/members/audit-user').set({ uid: 'audit-user', role: 'member', sharing: { availability: true } });
  const member = doc(db, 'groups/audit-group/members/audit-user');
  await allow(updateDoc(member, { 'sharing.availability': false }));
  await deny(updateDoc(member, { role: 'owner' }));
  await deny(updateDoc(member, { uid: 'someone-else' }));
  await deny(updateDoc(member, { role: deleteField() }));
  console.log(`${checks} Firestore emulator checks passed.`);
} finally {
  await terminate(db);
  await deleteApp(app);
  await admin.terminate();
}
