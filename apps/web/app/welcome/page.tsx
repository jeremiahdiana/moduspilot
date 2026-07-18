import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { FOUNDING_COOKIE, verifyGate, getFoundingCode, FOUNDING_CAP } from '@/lib/founding';
import Aurora from '../grandfathering/Aurora';
import WelcomeSequence from './WelcomeSequence';

export const metadata: Metadata = {
  title: 'Welcome, Founding Member — MODUS',
  robots: { index: false, follow: false },
};

// Shown once, right after a founder completes checkout (Stripe success_url).
// Reads their card details from the gate cookie; if there's no founding claim,
// there's nothing to celebrate — send them to the app.
export default async function WelcomePage() {
  const codeId = verifyGate(cookies().get(FOUNDING_COOKIE)?.value);
  const code = codeId ? await getFoundingCode(codeId) : null;
  if (!code) redirect('/dashboard');

  return (
    <div className="fm-scene bg-bg text-text">
      <Aurora />
      <main className="relative z-10 min-h-dvh flex items-center justify-center px-6 py-16">
        <WelcomeSequence label={code.label} foundingNumber={code.foundingNumber} cap={FOUNDING_CAP} />
      </main>
    </div>
  );
}
