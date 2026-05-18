'use client';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4">
      <p className="text-4xl font-bold text-text">500</p>
      <p className="text-muted text-sm">Something went wrong.</p>
      <button onClick={reset} className="text-brand text-sm hover:underline">Try again</button>
    </div>
  );
}
