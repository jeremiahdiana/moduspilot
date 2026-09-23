/**
 * Regenerates public/og.png — the moduspilot.com link preview / social card.
 *
 * The card is a static asset (no next/og, no ImageResponse). Every page's
 * metadata points at the single path /og.png, so replacing this one file
 * updates the preview site-wide. Source markup lives in scripts/og-template.html
 * and must stay matched to the live hero (components/marketing/HeroSection.tsx).
 * Brand rule: violet stays (AGENTS.md).
 *
 * Renders the template with headless Chrome at 1200x630 and a 2x device scale,
 * producing a 2400x1260 PNG (the 1.91:1 ratio socials expect).
 *
 * Run:  cd apps/web && node scripts/gen-og-image.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');

const CHROME =
  process.env.CHROME_BIN ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const templatePath = join(here, 'og-template.html');
const logoPath = join(webRoot, 'public', 'logo-dark.png');
const outPath = join(webRoot, 'public', 'og.png');

function main() {
  if (!existsSync(CHROME)) {
    throw new Error(
      `Chrome not found at "${CHROME}". Set CHROME_BIN to a Chrome/Chromium binary.`,
    );
  }

  // Inline the logo so the rendered page needs no local file access.
  const logoData = readFileSync(logoPath).toString('base64');
  const logoSrc = `data:image/png;base64,${logoData}`;
  const html = readFileSync(templatePath, 'utf8').replaceAll('__LOGO_SRC__', logoSrc);

  const workdir = mkdtempSync(join(tmpdir(), 'modus-og-'));
  const htmlPath = join(workdir, 'og.html');
  writeFileSync(htmlPath, html);

  console.log('[gen-og-image] rendering og.png at 2400x1260…');
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=2',
      '--window-size=1200,630',
      '--default-background-color=00000000',
      '--virtual-time-budget=2500', // let web fonts load and settle
      `--screenshot=${outPath}`,
      `file://${htmlPath}`,
    ],
    { stdio: 'inherit' },
  );

  console.log(`[gen-og-image] wrote ${outPath}`);
}

main();
