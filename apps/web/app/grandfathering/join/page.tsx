import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { FOUNDING_COOKIE, verifyGate, getFoundingCode, claimedCount, FOUNDING_CAP } from '@/lib/founding';
import Aurora from '../Aurora';
import FoundingJourney from '../FoundingJourney';

export const metadata: Metadata = {
  title: 'MODUS: claim your founding seat',
  robots: { index: false, follow: false },
};

// The cinematic value journey. Only reachable with a valid founding key; without
// one there's nothing to claim, so send them back to the gate.
export default async function FoundingJoinPage() {
  const codeId = verifyGate(cookies().get(FOUNDING_COOKIE)?.value);
  const code = codeId ? await getFoundingCode(codeId) : null;
  if (!code) redirect('/grandfathering');
  if (code.status === 'claimed') redirect('/grandfathering'); // already claimed → offer shows "secured"

  const claimed = await claimedCount();

  return (
    <div className="fm-scene bg-bg text-text flex flex-col min-h-dvh">
      <Aurora />
      <FoundingJourney label={code.label} foundingNumber={code.foundingNumber} cap={FOUNDING_CAP} claimed={claimed} />
    </div>
  );
}
