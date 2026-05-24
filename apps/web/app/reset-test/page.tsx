'use client';

import { useState } from 'react';
import { auth } from '@/lib/firebase';

export default function ResetTestPage() {
  const [status, setStatus] = useState('');

  async function reset() {
    setStatus('Wiping account data...');
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) { setStatus('Not logged in — go log in first, then come back here.'); return; }
      const res = await fetch('/api/debug/reset-user', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setStatus('Done! Redirecting to onboarding...');
        setTimeout(() => { window.location.href = '/onboarding'; }, 800);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Reset test account</h1>
      <p>Wipes all Firestore data (Google accounts, goals, habits, tasks, conversations, memories) and resets onboarding. You stay logged in.</p>
      <button onClick={reset} style={{ padding: '12px 24px', fontSize: 16, cursor: 'pointer' }}>
        Reset &amp; go to onboarding
      </button>
      {status && <p style={{ marginTop: 20, fontWeight: 'bold' }}>{status}</p>}
    </div>
  );
}
