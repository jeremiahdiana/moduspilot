'use client';

import TipsSettings from '@/components/settings/TipsSettings';

// Tips & Tricks used to be a Settings tab, but it's documentation, not settings.
// It now lives at /help.
export default function HelpPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 md:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-medium text-text">Tips &amp; Tricks</h1>
          <p className="text-sm text-muted mt-1">Get the most out of MODUS.</p>
        </div>
        <TipsSettings />
      </div>
    </div>
  );
}
