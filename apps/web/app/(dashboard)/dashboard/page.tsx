'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import DashboardGrid from '@/components/dashboard/DashboardGrid';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] ?? '';

  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">
          {greeting()}{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="text-muted text-sm mt-1">Here&apos;s your dashboard.</p>
      </div>
      <DashboardGrid />
    </div>
  );
}
