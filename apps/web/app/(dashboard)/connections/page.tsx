'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import ConnectorsSettings from '@/components/settings/ConnectorsSettings';

export default function ConnectionsPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted text-sm">Sign in to manage connections.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto py-6 px-4 md:py-10 md:px-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-text">Connections</h1>
          <p className="text-sm text-muted mt-1.5">Connect your tools so MODUS can see your full context.</p>
        </div>
        <ConnectorsSettings user={user} />
      </div>
    </div>
  );
}
