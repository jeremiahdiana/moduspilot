'use client';

import { useEffect, useState } from 'react';

// Mirrors FOUNDING_CLOSES_AT in lib/founding.ts. Duplicated (not imported) on
// purpose: lib/founding.ts pulls in firebase-admin, which breaks the client
// bundle (it needs Node's fs/net/http2). Keep this Date literal in sync with
// lib/founding.ts if the close date ever changes.
const FOUNDING_CLOSES_AT = new Date('2026-08-01T00:00:00Z');

function timeLeft(): string | null {
  const ms = FOUNDING_CLOSES_AT.getTime() - Date.now();
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${d}d ${h}h ${m}m`;
}

export default function FoundingUrgency() {
  const [left, setLeft] = useState<string | null>(null);

  useEffect(() => {
    setLeft(timeLeft());
    const t = setInterval(() => setLeft(timeLeft()), 60000);
    return () => clearInterval(t);
  }, []);

  if (left === null) return null;

  return (
    <div className="text-[11px]">
      <span className="text-muted">
        Founding closes in <span className="tabular-nums text-brand dark:text-violet-300 font-medium">{left}</span>
      </span>
    </div>
  );
}
