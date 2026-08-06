'use client';

import { useEffect, useState } from 'react';

// The desktop shell tags its user agent with "MODUSDesktop/<version>" (see
// apps/desktop/src/main/windows.ts). userAgent is only available in the browser,
// so read it in an effect to avoid a hydration mismatch between server and client.
function readDesktopVersion(): string | null {
  if (typeof navigator === 'undefined') return null;
  const m = navigator.userAgent.match(/MODUSDesktop\/([\w.]+)/);
  return m ? m[1] : null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-bg border border-border">
      <span className="text-sm text-text">{label}</span>
      <span className="text-xs font-mono text-muted">{value}</span>
    </div>
  );
}

export default function AboutSettings() {
  const [desktopVersion, setDesktopVersion] = useState<string | null>(null);

  useEffect(() => {
    setDesktopVersion(readDesktopVersion());
  }, []);

  const commit = process.env.NEXT_PUBLIC_COMMIT_SHA;
  const webBuild = commit ? commit.slice(0, 7) : 'dev';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">About</h2>
        <p className="text-sm text-muted">Version details for this build of Modus.</p>
      </div>

      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-text">Version</h3>
        <div className="space-y-2">
          {desktopVersion && <Row label="Desktop app" value={`v${desktopVersion}`} />}
          <Row label="Web build" value={webBuild} />
        </div>
        {desktopVersion ? (
          <p className="text-xs text-muted/70">
            The desktop app updates itself automatically — it downloads on launch and installs when you quit.
          </p>
        ) : (
          <p className="text-xs text-muted/70">
            You are using Modus in the browser, which always runs the latest build.
          </p>
        )}
      </div>
    </div>
  );
}
