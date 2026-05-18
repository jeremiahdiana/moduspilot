'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4">
      <p className="text-4xl font-bold text-text">404</p>
      <p className="text-muted text-sm">Page not found.</p>
      <Link href="/" className="text-brand text-sm hover:underline">Go home</Link>
    </div>
  );
}
