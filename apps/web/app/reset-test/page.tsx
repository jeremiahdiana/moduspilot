'use client';

import { useState } from 'react';
import { auth } from '@/lib/firebase';

export default function ResetTestPage() {
  const [status, setStatus] = useState('');

  async function reset() {
    setStatus('Resetting...');
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) { setStatus('Not logged in — go log in first, then come back here.'); return; }
      const res = await fetch('/api/debug/reset-user', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStatus(data.ok ? 'Done! Account reset. Go test onboarding now.' : `Error: ${data.error}`);
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Reset test account</h1>
      <p>Clears stale Google tokens and resets onboardingComplete so you can test fresh.</p>
      <button onClick={reset} style={{ padding: '12px 24px', fontSize: 16, cursor: 'pointer' }}>
        Reset my account
      </button>
      {status && <p style={{ marginTop: 20, fontWeight: 'bold' }}>{status}</p>}
    </div>
  );
}
