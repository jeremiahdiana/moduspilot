import dns from 'dns';

/**
 * SSRF guard for user-supplied URLs (MCP server endpoints).
 *
 * Without this, a signed-in user can point an "MCP server" at an internal
 * address — http://169.254.169.254/ (cloud metadata), http://localhost, or
 * RFC-1918 hosts — and our server will dutifully fetch it, turning the feature
 * into a server-side request forgery primitive against our own infrastructure.
 *
 * We require http/https, reject obvious private hostnames, AND resolve the host
 * and reject if ANY resolved address is private/loopback/link-local (catches a
 * public domain that points at an internal IP).
 */

function ipToLong(ip: string): number | null {
  const m = ip.split('.');
  if (m.length !== 4) return null;
  let n = 0;
  for (const part of m) {
    const o = Number(part);
    if (!Number.isInteger(o) || o < 0 || o > 255) return null;
    n = n * 256 + o;
  }
  return n >>> 0;
}

function inV4Range(ip: number, base: string, bits: number): boolean {
  const b = ipToLong(base)!;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) === (b & mask);
}

function isPrivateV4(ip: string): boolean {
  const n = ipToLong(ip);
  if (n === null) return false;
  return (
    inV4Range(n, '0.0.0.0', 8) ||
    inV4Range(n, '10.0.0.0', 8) ||
    inV4Range(n, '100.64.0.0', 10) ||   // CGNAT
    inV4Range(n, '127.0.0.0', 8) ||     // loopback
    inV4Range(n, '169.254.0.0', 16) ||  // link-local incl. 169.254.169.254 metadata
    inV4Range(n, '172.16.0.0', 12) ||
    inV4Range(n, '192.0.0.0', 24) ||
    inV4Range(n, '192.168.0.0', 16) ||
    inV4Range(n, '198.18.0.0', 15)      // benchmarking
  );
}

function isPrivateV6(ip: string): boolean {
  const a = ip.toLowerCase();
  if (a === '::1' || a === '::') return true;
  if (a.startsWith('fc') || a.startsWith('fd')) return true; // unique local fc00::/7
  if (a.startsWith('fe80') || a.startsWith('fe9') || a.startsWith('fea') || a.startsWith('feb')) return true; // link-local fe80::/10
  // IPv4-mapped (::ffff:a.b.c.d) — check the embedded v4
  const mapped = a.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateV4(mapped[1]);
  return false;
}

function isPrivateAddr(ip: string): boolean {
  return ip.includes(':') ? isPrivateV6(ip) : isPrivateV4(ip);
}

/** Throws if `rawUrl` is not a safe, public http(s) endpoint. */
export async function assertPublicUrl(rawUrl: string): Promise<void> {
  let u: URL;
  try { u = new URL(rawUrl); } catch { throw new Error('Invalid URL'); }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed');
  }

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('URL points to a disallowed host');
  }

  // If the host is already an IP literal, check it directly.
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    if (isPrivateAddr(host)) throw new Error('URL points to a private address');
    return;
  }

  // Resolve and reject if ANY address is private (defeats domains → internal IP).
  const addrs = await dns.promises.lookup(host, { all: true }).catch(() => []);
  if (addrs.length === 0) throw new Error('Host could not be resolved');
  for (const { address } of addrs) {
    if (isPrivateAddr(address)) throw new Error('URL resolves to a private address');
  }
}
