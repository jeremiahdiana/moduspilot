/**
 * Make third-party MCP tool schemas safe to send to a strict provider.
 *
 * 🪤 THE OUTAGE THIS EXISTS FOR. GitMCP publishes `search_generic_code` with an
 * optional `page` property that is absent from `required`. OpenAI's function
 * schema validation rejects that outright:
 *
 *   AI_APICallError: Invalid schema for function 'search_generic_code':
 *   'required' is required to be supplied and to be an array including every
 *   key in properties. Missing 'page'.
 *
 * The whole request 400s before a single token — so on 2026-07-23 EVERY
 * non-small-talk message on gpt-5.6-terra returned a blank bubble, because MCP
 * tools ride along on every one of them. Measured against live prod, all three
 * of "what's on my calendar", "any emails i should care about" and "reply with
 * one short sentence" returned 0 characters.
 *
 * We do not control what a connected server publishes, and MCP has no schema
 * conformance requirement — so the boundary where a foreign schema enters our
 * request is the only place this can be fixed. Normalise it here, once, for
 * every provider rather than special-casing OpenAI: a schema that satisfies the
 * strictest provider is still valid for the lenient ones.
 *
 * The contract OpenAI enforces:
 *   1. every object's `required` lists EVERY key in `properties`
 *   2. a genuinely optional property must therefore be nullable instead
 *   3. objects declare `additionalProperties: false`
 *
 * (2) is what keeps this from changing tool semantics: `page` stays skippable,
 * the model just passes null rather than omitting the key.
 */

type JsonSchema = Record<string, unknown>;

const isPlainObject = (v: unknown): v is JsonSchema =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Widen a property schema so `null` is an accepted value. */
function makeNullable(schema: unknown): unknown {
  if (!isPlainObject(schema)) return schema;

  // A union already spelled out as anyOf/oneOf gets a null branch appended,
  // which is the only form that works when branches have different shapes.
  for (const key of ['anyOf', 'oneOf'] as const) {
    const branches = schema[key];
    if (Array.isArray(branches)) {
      const hasNull = branches.some((b) => isPlainObject(b) && b.type === 'null');
      return hasNull ? schema : { ...schema, [key]: [...branches, { type: 'null' }] };
    }
  }

  const type = schema.type;
  if (typeof type === 'string') {
    return type === 'null' ? schema : { ...schema, type: [type, 'null'] };
  }
  if (Array.isArray(type)) {
    return type.includes('null') ? schema : { ...schema, type: [...type, 'null'] };
  }
  // No `type` to widen (e.g. a bare enum or an empty schema) — anything is
  // already permitted, so null is too. Touching it would only risk breaking it.
  return schema;
}

/**
 * Recursively normalise a JSON Schema. Pure: the input is never mutated, so a
 * cached tool definition cannot be corrupted by being sanitised twice.
 */
export function normalizeJsonSchema(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(normalizeJsonSchema);
  if (!isPlainObject(input)) return input;

  const out: JsonSchema = { ...input };

  // Recurse into every place a subschema can hide.
  for (const key of ['items', 'additionalItems', 'not', 'if', 'then', 'else'] as const) {
    if (key in out) out[key] = normalizeJsonSchema(out[key]);
  }
  for (const key of ['anyOf', 'oneOf', 'allOf', 'prefixItems'] as const) {
    if (Array.isArray(out[key])) out[key] = (out[key] as unknown[]).map(normalizeJsonSchema);
  }
  for (const key of ['$defs', 'definitions'] as const) {
    if (isPlainObject(out[key])) {
      out[key] = Object.fromEntries(
        Object.entries(out[key] as JsonSchema).map(([k, v]) => [k, normalizeJsonSchema(v)]),
      );
    }
  }
  // `additionalProperties` is a schema when it is an object, a flag when boolean.
  if (isPlainObject(out.additionalProperties)) {
    out.additionalProperties = normalizeJsonSchema(out.additionalProperties);
  }

  if (!isPlainObject(out.properties)) return out;

  const properties = out.properties as JsonSchema;
  const keys = Object.keys(properties);
  const required = Array.isArray(out.required) ? (out.required as string[]) : [];
  const optional = new Set(keys.filter((k) => !required.includes(k)));

  out.properties = Object.fromEntries(
    keys.map((k) => {
      const normalised = normalizeJsonSchema(properties[k]);
      // Only widen what was optional — a required property keeps its exact type.
      return [k, optional.has(k) ? makeNullable(normalised) : normalised];
    }),
  );

  // Rule 1: every key is required. Rule 2 (above) is what makes that honest.
  if (keys.length > 0) out.required = keys;
  // Rule 3: only assert this when the schema has not already decided for itself.
  if (!('additionalProperties' in out)) out.additionalProperties = false;

  return out;
}

/**
 * Does any object in this schema declare a property it leaves out of `required`?
 * That — not the cosmetic `additionalProperties` default — is the condition that
 * actually 400s a request, so it is the only thing worth naming in a log.
 */
function hasIncompleteRequired(input: unknown): boolean {
  if (Array.isArray(input)) return input.some(hasIncompleteRequired);
  if (!isPlainObject(input)) return false;

  if (isPlainObject(input.properties)) {
    const keys = Object.keys(input.properties as JsonSchema);
    const required = Array.isArray(input.required) ? (input.required as string[]) : [];
    if (keys.some((k) => !required.includes(k))) return true;
  }
  return Object.values(input).some(hasIncompleteRequired);
}

/**
 * Normalise the schemas of a toolset returned by `mcpClient.tools()`.
 *
 * The AI SDK wraps each tool's schema in a Schema object carrying an internal
 * symbol and a `validate` fn, so we replace `jsonSchema` INSIDE that wrapper
 * rather than rebuilding it — a fresh object would drop the symbol and the SDK
 * would stop recognising it as a schema at all.
 *
 * `nonConforming` names only the tools that would have failed a strict provider,
 * so a server shipping a broken schema stays visible in logs rather than being
 * silently patched forever. Every schema is still normalised.
 */
export function sanitizeMcpToolSchemas(
  tools: Record<string, unknown>,
): { tools: Record<string, unknown>; nonConforming: string[] } {
  const nonConforming: string[] = [];

  for (const [name, tool] of Object.entries(tools)) {
    if (!isPlainObject(tool)) continue;
    const parameters = tool.parameters;
    if (!isPlainObject(parameters)) continue;

    const original = parameters.jsonSchema;
    if (original === undefined) continue;

    if (hasIncompleteRequired(original)) nonConforming.push(name);
    parameters.jsonSchema = normalizeJsonSchema(original);
  }

  return { tools, nonConforming };
}

/**
 * Stop a failing tool from costing the user their answer.
 *
 * 🪤 An error thrown inside a tool's `execute` propagates out of the stream as
 * AI_ToolExecutionError and ENDS the response. Observed on 2026-07-23: the model
 * called GitMCP's `search_generic_documentation` without its required `query`,
 * the server returned `MCP error -32602: Invalid arguments`, and the whole turn
 * finished with `finishReason: tool-calls` and ZERO characters — a blank bubble
 * caused by a third party's argument validation.
 *
 * We cannot stop a model from mis-calling a tool, or a remote server from
 * rejecting it. We can stop that from being fatal: hand the failure back as an
 * ordinary tool RESULT, which is a thing the model knows how to recover from,
 * and let it finish the turn in words. A degraded answer beats no answer.
 *
 * The message is written for the model, not the user — it says what failed and
 * what to do next, because a bare error string tends to get parroted verbatim.
 */
export function makeToolErrorsNonFatal(
  tools: Record<string, unknown>,
  onError?: (toolName: string, message: string) => void,
): Record<string, unknown> {
  for (const [name, tool] of Object.entries(tools)) {
    if (!isPlainObject(tool)) continue;
    const execute = tool.execute;
    if (typeof execute !== 'function') continue;

    const original = execute as (...args: unknown[]) => unknown;
    tool.execute = async (...args: unknown[]) => {
      try {
        return await original(...args);
      } catch (e) {
        const message = String(e).slice(0, 300);
        onError?.(name, message);
        return {
          error: true,
          tool: name,
          message,
          instruction:
            `The ${name} tool failed and cannot be retried on this turn. Answer the user ` +
            `from what you already know, and say plainly that the tool was unavailable. ` +
            `Do not repeat this error text to the user.`,
        };
      }
    };
  }
  return tools;
}
