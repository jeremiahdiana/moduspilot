import { cookies } from 'next/headers';
import Image from 'next/image';
import type { Metadata } from 'next';
import { FOUNDING_COOKIE, verifyGate, getFoundingCode, claimedCount, FOUNDING_CAP } from '@/lib/founding';
import PasswordGate from './PasswordGate';
import FoundingOffer from './FoundingOffer';

export const metadata: Metadata = {
  title: 'MODUS — Founding Members',
  description: 'A private invitation to the first 100 members of MODUS.',
  robots: { index: false, follow: false },
};

// Reads the gate cookie server-side so the secret founding data never ships to
// a client that hasn't entered a valid password.
export default async function GrandfatheringPage() {
  const codeId = verifyGate(cookies().get(FOUNDING_COOKIE)?.value);
  const code = codeId ? await getFoundingCode(codeId) : null;
  const claimed = code ? await claimedCount() : 0;

  return (
    <div className="relative min-h-screen bg-bg text-text flex flex-col items-center justify-center px-6 py-16 overflow-hidden">
      {/* Premium background — matches the login aesthetic */}
      <div className="fixed inset-0 -z-10 bg-bg">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950/60 via-bg to-bg dark:from-violet-950/40" />
        <div className="hero-orb hero-orb-1" style={{ opacity: 0.6 }} />
        <div className="hero-orb hero-orb-2" style={{ opacity: 0.45 }} />
        <div className="hero-orb hero-orb-3" style={{ opacity: 0.35 }} />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(124,58,237,0.10)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_45%,rgba(124,58,237,0.08),transparent_70%)]" />
      </div>

      {/* Wordmark */}
      <div className="flex flex-col items-center mb-8">
        <Image src="/logo.png" alt="MODUS" width={64} height={48} className="object-contain block dark:hidden mb-3" priority />
        <Image src="/logo-dark.png" alt="MODUS" width={64} height={48} className="object-contain hidden dark:block mb-3" priority />
        <h1 className="hero-gradient-text text-3xl font-black tracking-widest">MODUS</h1>
        <p className="text-muted text-xs tracking-widest uppercase mt-1">Founding Members</p>
      </div>

      {code
        ? <FoundingOffer
            label={code.label}
            foundingNumber={code.foundingNumber}
            status={code.status}
            claimed={claimed}
            cap={FOUNDING_CAP}
          />
        : <PasswordGate />}
    </div>
  );
}
