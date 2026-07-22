/**
 * Dump the RAW tool schemas each connected MCP server publishes.
 *
 * The blank-bubble outage traced to one of these being rejected by OpenAI's
 * function-schema validation, so the fix has to be written against the real
 * shapes rather than a guess at them.
 *
 *   cd apps/web && npx tsx scripts/dump-mcp-schemas.ts [uid]
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

const UID = process.argv[2] || 'hSBcOHKSX9eCHaKSDczccTRzv093';

async function main() {
  const { getMcpServers } = await import('../lib/mcp-servers');
  const { connectMcpClient } = await import('../lib/mcp-client');

  const servers = await getMcpServers(UID);
  console.log(`\n${servers.length} MCP server(s) for uid ${UID}\n`);

  for (const s of servers) {
    console.log(`── ${s.name} (${s.transport}) ${s.url}`);
    let client;
    try {
      client = await connectMcpClient({ url: s.url, authHeader: s.authHeader, transport: s.transport });
      const tools = await client.tools();
      for (const [name, tool] of Object.entries(tools)) {
        // The AI SDK wraps MCP schemas in a Schema object; the raw JSON Schema
        // is what actually reaches the provider.
        const t = tool as { parameters?: { jsonSchema?: unknown } };
        const schema = t.parameters?.jsonSchema ?? t.parameters;
        const props = (schema as { properties?: Record<string, unknown> })?.properties ?? {};
        const req = (schema as { required?: string[] })?.required;
        const missing = Object.keys(props).filter((k) => !(req ?? []).includes(k));
        console.log(`\n  • ${name}`);
        console.log(`    properties: [${Object.keys(props).join(', ')}]`);
        console.log(`    required:   ${req ? `[${req.join(', ')}]` : '(ABSENT)'}`);
        if (missing.length) console.log(`    ⚠️  not in required: [${missing.join(', ')}]  ← what OpenAI rejects`);
      }
    } catch (e) {
      console.log(`  ❌ ${String(e).slice(0, 200)}`);
    } finally {
      try { await client?.close(); } catch { /* noop */ }
    }
    console.log('');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
