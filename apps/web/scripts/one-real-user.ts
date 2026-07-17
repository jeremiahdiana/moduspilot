/**
 * The only non-founder account MODUS has ever had (kahzaticfanboy@gmail.com,
 * signed up 2026-07-08, never returned). Did the product fail them, or did
 * they just leave? Read-only. Prints structure/metadata, not personal content:
 * per-conversation message counts, roles, timestamps, model, and error blocks.
 *
 *   cd apps/web && npx tsx scripts/one-real-user.ts [uid]
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

const UID = process.argv[2] || 'ALBLD4Ja0hVHgoQmnKcYELMhky72';

function ts(v: any): string {
  if (!v) return '—';
  const d = typeof v?.toDate === 'function' ? v.toDate() : new Date(v?._seconds ? v._seconds * 1000 : v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString().replace('T', ' ').slice(0, 19);
}

async function main() {
  const { adminDb } = await import('@/lib/firebase-admin');
  const ref = adminDb.collection('users').doc(UID);

  const convos = await ref.collection('conversations').orderBy('createdAt', 'asc').get();
  console.log(`\n=== ${convos.size} conversation(s) ===\n`);

  for (const c of convos.docs) {
    const d: any = c.data();
    console.log(`convo ${c.id}`);
    console.log(`  title=${JSON.stringify(d.title ?? '—')}`);
    console.log(`  createdAt=${ts(d.createdAt)}  updatedAt=${ts(d.updatedAt)}`);

    const msgs: any[] = Array.isArray(d.messages) ? d.messages : [];
    const sub = msgs.length ? [] : (await c.ref.collection('messages').orderBy('createdAt', 'asc').get()).docs.map((m) => m.data());
    const all = msgs.length ? msgs : sub;
    console.log(`  ${all.length} message(s)`);

    for (const m of all) {
      const role = m.role ?? '?';
      const text = String(m.content ?? (Array.isArray(m.parts) ? m.parts.map((p: any) => p.text ?? '').join('') : '') ?? '');
      const blocks = Array.isArray(m.blocks) ? m.blocks.map((b: any) => b.type).join(',') : '';
      const err = /error|sorry|unable|cannot|failed|try again/i.test(text.slice(0, 300));
      console.log(`    [${role}] ${text.length} chars${blocks ? ` blocks=${blocks}` : ''}${m.model ? ` model=${m.model}` : ''}${err ? '  ⚠️ looks like a failure/apology' : ''}`);
      if (role === 'user') console.log(`         user said: ${JSON.stringify(text.slice(0, 200))}`);
      else if (err) console.log(`         opens: ${JSON.stringify(text.slice(0, 200))}`);
    }
    console.log();
  }

  for (const name of ['goals', 'habits', 'memories', 'notifications', 'tasks']) {
    try {
      const s = await ref.collection(name).count().get();
      if (s.data().count) console.log(`${name}: ${s.data().count}`);
    } catch { /* absent */ }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
