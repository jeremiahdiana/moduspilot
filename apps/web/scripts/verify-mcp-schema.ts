/**
 * Assert that a foreign MCP schema cannot 400 a model request again.
 *
 * The fixture is GitMCP's REAL `search_generic_code` shape, captured from the
 * live server on 2026-07-23 (scripts/dump-mcp-schemas.ts) — the exact schema
 * that returned:
 *   Invalid schema for function 'search_generic_code': 'required' is required
 *   to be supplied and to be an array including every key in properties.
 *   Missing 'page'.
 *
 * No API key and no network needed.
 *
 *   cd apps/web && npx tsx scripts/verify-mcp-schema.ts
 */
import { normalizeJsonSchema, sanitizeMcpToolSchemas, makeToolErrorsNonFatal } from '../lib/mcp-schema';

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log(`   ${JSON.stringify(detail)}`);
  }
}

// ── 1. The real GitMCP schema that broke production ────────────────────────
const gitmcpSearchCode = {
  type: 'object',
  properties: {
    owner: { type: 'string', description: 'Repository owner' },
    repo: { type: 'string', description: 'Repository name' },
    query: { type: 'string', description: 'The search query' },
    page: { type: 'number', description: 'Page number (optional)' },
  },
  required: ['owner', 'repo', 'query'],
};

const fixed = normalizeJsonSchema(gitmcpSearchCode) as Record<string, unknown>;
const props = fixed.properties as Record<string, Record<string, unknown>>;

check(
  'required lists every property (the exact OpenAI complaint)',
  JSON.stringify(fixed.required) === JSON.stringify(['owner', 'repo', 'query', 'page']),
  fixed.required,
);
check(
  'the optional `page` became nullable, so it stays skippable',
  JSON.stringify(props.page.type) === JSON.stringify(['number', 'null']),
  props.page.type,
);
check(
  'a genuinely required property keeps its exact type',
  props.owner.type === 'string',
  props.owner.type,
);
check('additionalProperties is closed', fixed.additionalProperties === false);
check(
  'descriptions survive (they are what the model routes on)',
  props.page.description === 'Page number (optional)',
);

// ── 2. Purity: sanitising twice must not compound ──────────────────────────
check(
  'normalising an already-normalised schema is a no-op',
  JSON.stringify(normalizeJsonSchema(fixed)) === JSON.stringify(fixed),
);
check(
  'the input schema was not mutated',
  JSON.stringify(gitmcpSearchCode.required) === JSON.stringify(['owner', 'repo', 'query']),
  gitmcpSearchCode.required,
);

// ── 3. Nested shapes, which a future plugin will certainly ship ────────────
const nested = normalizeJsonSchema({
  type: 'object',
  properties: {
    filter: {
      type: 'object',
      properties: { since: { type: 'string' }, limit: { type: 'integer' } },
      required: ['since'],
    },
    tags: { type: 'array', items: { type: 'object', properties: { k: { type: 'string' } } } },
  },
  required: ['filter'],
}) as Record<string, unknown>;
const nestedProps = nested.properties as Record<string, Record<string, unknown>>;
check(
  'nested object properties are normalised too',
  JSON.stringify((nestedProps.filter.properties as Record<string, Record<string, unknown>>).limit.type)
    === JSON.stringify(['integer', 'null']),
);
check(
  'array item schemas are normalised',
  JSON.stringify((nestedProps.tags.items as Record<string, unknown>).required) === JSON.stringify(['k']),
);

// ── 4. anyOf unions get a null branch, not a broken `type` ─────────────────
const union = normalizeJsonSchema({
  type: 'object',
  properties: { id: { anyOf: [{ type: 'string' }, { type: 'number' }] } },
  required: [],
}) as Record<string, unknown>;
const unionId = (union.properties as Record<string, Record<string, unknown>>).id;
check(
  'an optional anyOf gains a null branch',
  JSON.stringify(unionId.anyOf) === JSON.stringify([{ type: 'string' }, { type: 'number' }, { type: 'null' }]),
  unionId.anyOf,
);

// ── 5. The wrapper path the route actually calls ───────────────────────────
const toolset = {
  search_generic_code: { parameters: { jsonSchema: { ...gitmcpSearchCode } } },
  fetch_generic_url_content: {
    parameters: { jsonSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  },
};
const { tools, nonConforming } = sanitizeMcpToolSchemas(toolset as unknown as Record<string, unknown>);
check(
  'only the genuinely broken tool is named — a conforming one is normalised quietly',
  JSON.stringify(nonConforming) === JSON.stringify(['search_generic_code']),
  nonConforming,
);
check(
  'the conforming tool was still closed to extra properties',
  ((tools.fetch_generic_url_content as { parameters: { jsonSchema: Record<string, unknown> } })
    .parameters.jsonSchema).additionalProperties === false,
);
check(
  'the sanitised schema is written back into the SDK wrapper',
  JSON.stringify(
    ((tools.search_generic_code as { parameters: { jsonSchema: Record<string, unknown> } }).parameters.jsonSchema).required,
  ) === JSON.stringify(['owner', 'repo', 'query', 'page']),
);

// ── 6. A throwing tool must not end the turn ───────────────────────────────
// Replays the real failure: GitMCP returned `MCP error -32602: Invalid
// arguments` and the whole reply came back empty with finishReason 'tool-calls'.
async function toolErrorChecks() {
  const reported: string[] = [];
  const toolset = {
    search_generic_documentation: {
      execute: async () => { throw new Error('MCP error -32602: Invalid arguments for tool'); },
    },
    fetch_generic_url_content: { execute: async () => ({ ok: true }) },
  };

  const hardened = makeToolErrorsNonFatal(
    toolset as unknown as Record<string, unknown>,
    (name, msg) => reported.push(`${name}: ${msg.slice(0, 30)}`),
  );
  const failing = hardened.search_generic_documentation as { execute: () => Promise<Record<string, unknown>> };
  const working = hardened.fetch_generic_url_content as { execute: () => Promise<Record<string, unknown>> };

  let result: Record<string, unknown>;
  try {
    result = await failing.execute();
    check('a throwing tool RESOLVES instead of rejecting (was: whole reply lost)', true);
  } catch {
    check('a throwing tool RESOLVES instead of rejecting (was: whole reply lost)', false);
    return;
  }

  check('the failure is handed back as a tool result the model can recover from', result.error === true);
  check('the result names the tool that failed', result.tool === 'search_generic_documentation');
  check('the model is told not to parrot the error', String(result.instruction).includes('Do not repeat'));
  check('the failure is reported for logging', reported.length === 1, reported);
  check('a healthy tool still returns its real value', JSON.stringify(await working.execute()) === '{"ok":true}');
}

toolErrorChecks().then(() => {
  console.log(`\n${failures === 0 ? '✅ all checks passed' : `❌ ${failures} check(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
});
