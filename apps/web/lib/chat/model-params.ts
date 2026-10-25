/**
 * Per-model request parameters that are PROVIDER CONSTRAINTS, not preferences.
 *
 * 🚨 THESE LIVED AS INLINE REGEXES IN route.ts AND ONE OF THEM WAS SPELLED WRONG.
 *
 * The temperature guard was `/^claude-.*-5$/` — "the id ends in -5" — which was
 * true of claude-sonnet-5 and claude-fable-5 and FALSE of `claude-opus-4-8`. So
 * the most expensive model in the catalog 400'd on every single message from the
 * day it was listed:
 *
 *   AI_APICallError: `temperature` is deprecated for this model.
 *
 * The reasoning-budget test had the same shape (`/-5$/`), so Opus also got the
 * 2048 cap that exists precisely to stop thinking models returning blank bubbles.
 * Two independent breakages, one root cause: a provider constraint was keyed on
 * how a version number happens to be spelled.
 *
 * They live here, exported, so scripts/verify-model-params.ts can walk the WHOLE
 * catalog and fail the moment a listed model would be sent parameters its
 * provider rejects — including a model added next month.
 */
import { canonicalModelId } from '@/lib/models';

/**
 * The FAMILY tests every gate below is built from. One definition, so a new
 * generation is either covered everywhere or nowhere.
 *
 * 🚨 These were `/^gpt-5/` and `/^gemini-3/`, copied into four files. Found
 * 2026-10-25 while adding GPT-6 and Gemini 4: both models would have passed none
 * of them, which means a 2048 output cap (blank bubbles, both think by default),
 * dropped effort settings, and GPT-6 being sent function tools it 400s on.
 * Verified live that day: gpt-6.1-sol and gpt-6-astra return the same "Function
 * tools with reasoning_effort are not supported" error as gpt-5.6, and both new
 * Geminis spend thinking tokens on a three-word reply.
 *
 * The patterns cover the current major version AND every later one, so the next
 * release lands inside the gate instead of outside it.
 */
export function isOpenAIGptReasoning(id: string): boolean {
  return /^gpt-([5-9]|[1-9]\d)/.test(id);
}
export function isOpenAIReasoning(id: string): boolean {
  return /^o\d/.test(id) || isOpenAIGptReasoning(id);
}
export function isGeminiThinking(id: string): boolean {
  return /^gemini-([3-9]|[1-9]\d)/.test(id);
}

/**
 * Does this model reject an explicit non-default `temperature`?
 *
 * ai@4.3.19 hardcodes `temperature: temperature != null ? temperature : 0`, so
 * "send nothing" is not an option — the only way to serve these models is to
 * pass Anthropic's own default (1) explicitly. Verified: temp 0 → 400, temp 1 →
 * answers.
 *
 * Keyed on the FAMILY. Anthropic applies this to its current generation and the
 * naming does not track it, so matching a version suffix silently excludes every
 * future release.
 */
export function needsExplicitTemperature(modelId: string): boolean {
  return /^claude-/.test(canonicalModelId(modelId));
}

/**
 * Does this model spend hidden reasoning tokens against its own output budget?
 *
 * A flat 2048 cap is consumed entirely by thinking → finishReason 'length' with
 * zero visible characters → a blank bubble with a 200 status. Measured:
 *   gpt-5.6-sol    @2048 → 0 chars      @16000 → 4740 chars
 *   claude-sonnet-5@2048 → 0 chars      @16000 → 3541 chars
 *   gemini-3.5-flash@2048 → truncated   @16000 → complete
 */
export function isReasoningModel(modelId: string): boolean {
  const id = canonicalModelId(modelId);
  return isOpenAIReasoning(id)
    || /^claude-/.test(id)
    || isGeminiThinking(id);
}

/**
 * Output cap. A CAP, not a target — a short answer bills what it generates, so
 * the headroom costs nothing except on the long answers the user asked for.
 */
export function maxTokensFor(modelId: string): number {
  return isReasoningModel(modelId) ? 16000 : 2048;
}
