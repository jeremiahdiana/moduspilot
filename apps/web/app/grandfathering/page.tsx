import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { FOUNDING_COOKIE, verifyGate, getFoundingCode, claimedCount, FOUNDING_CAP } from '@/lib/founding';
import Aurora from './Aurora';
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
    <div className="fm-scene bg-bg text-text">
      <Aurora />
      <main className="relative z-10 min-h-dvh flex flex-col items-center justify-center px-6 py-16">
        {code
          ? <FoundingOffer
              label={code.label}
              foundingNumber={code.foundingNumber}
              status={code.status}
              claimed={claimed}
              cap={FOUNDING_CAP}
            />
          : <PasswordGate cap={FOUNDING_CAP} />}
      </main>
    </div>
  );
}
