/** Offline regression checks: npx tsx scripts/verify-ssrf.ts */
import assert from 'node:assert/strict';
import dns from 'node:dns';
import { assertPublicUrl } from '../lib/ssrf';

async function main() {
  const blocked = [
    'http://127.0.0.1', 'http://10.0.0.1', 'http://169.254.169.254',
    'http://[::1]', 'http://[0:0:0:0:0:0:0:1]', 'http://[::]',
    'http://[::ffff:127.0.0.1]', 'http://[::ffff:7f00:1]',
    'http://[::ffff:a9fe:a9fe]', 'http://[::ffff:192.168.1.1]',
    'http://[fc00::1]', 'http://[fd00::1]', 'http://[fe80::1]',
    'http://[fe81::1]', 'http://[fe8f::1]', 'http://[febf::1]',
    'http://localhost', 'file:///etc/hosts',
  ];
  for (const url of blocked) await assert.rejects(assertPublicUrl(url), /URL|host|http/i, url);
  for (const url of ['https://8.8.8.8', 'https://[2606:4700:4700::1111]', 'https://[::ffff:8.8.8.8]']) {
    await assert.doesNotReject(assertPublicUrl(url), url);
  }
  const lookup = dns.promises.lookup;
  try {
    dns.promises.lookup = (async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '0:0:0:0:0:ffff:7f00:1', family: 6 },
    ]) as unknown as typeof lookup;
    await assert.rejects(assertPublicUrl('https://mixed.example'), /private address/);
    dns.promises.lookup = (async () => [{ address: 'fe81::1', family: 6 }]) as unknown as typeof lookup;
    await assert.rejects(assertPublicUrl('https://linklocal.example'), /private address/);
  } finally { dns.promises.lookup = lookup; }
  console.log('23 SSRF regression checks passed (no network).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
