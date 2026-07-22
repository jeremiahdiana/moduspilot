import { experimental_wrapLanguageModel, type LanguageModel, type LanguageModelV1StreamPart } from 'ai';

/**
 * Repair provider streams that the installed AI SDK core refuses to parse.
 *
 * 🪤 THE OUTAGE THIS EXISTS FOR — "Sonnet 5 cannot answer emails".
 *
 * @ai-sdk/anthropic@1.2.12 emits a `reasoning-signature` part whenever a
 * `signature_delta` arrives inside a thinking block (dist/index.mjs:800), but it
 * only emits `reasoning` on a `thinking_delta` (:793). Claude 5 thinks
 * adaptively and is free to close a thinking block that carried NO thinking
 * text — signed, but empty. That yields a signature with nothing in front of it,
 * and ai@4.3.19 throws on exactly that shape:
 *
 *   InvalidStreamPart: reasoning-signature without reasoning   (ai:5406, :5833)
 *
 * It is thrown INSIDE the stream transform, so it never reaches `onError` or
 * `onFinish` — Next.js reports `failed to pipe response` and the socket closes.
 * On Vercel the request logs a healthy 200 with no error line at all, and the
 * user gets a blank bubble. Measured 2026-07-23: "any emails i should care
 * about" on claude-sonnet-5 returned 0 characters every single time, while the
 * same question on llama and gpt-5.6-terra answered fine. It looked like Claude
 * could not read email. Claude never got the chance to reply.
 *
 * Why a middleware and not an SDK upgrade: ai@5 is a rewrite, and this codebase
 * is deliberately built against v4 internals (StreamData, toDataStreamResponse,
 * detectPromptType, the Anthropic cache breakpoint). Swapping the SDK to fix a
 * one-part stream defect would put every one of those at risk at once. This is
 * the supported extension point, it is ~10 lines, and it deletes itself the day
 * the upstream fix lands.
 *
 * The rule is exactly core's own state machine (ai:5396-5412): a
 * `reasoning-signature` is valid only if a `reasoning` part has arrived since
 * the last one. An orphan is dropped — never the reasoning itself, and never
 * any other part. Dropping a signature costs nothing we use: it is an integrity
 * token for replaying thinking blocks back to Anthropic, which MODUS does not do.
 */
export function repairReasoningStream(model: LanguageModel): LanguageModel {
  // A string id has no stream to repair (and cannot be wrapped).
  if (typeof model === 'string') return model;

  return experimental_wrapLanguageModel({
    model,
    middleware: {
      wrapStream: async ({ doStream }) => {
        const { stream, ...rest } = await doStream();

        // State is per-doStream, which is per STEP — the same scope in which
        // core resets its own `activeReasoningText`. Tracking it any wider would
        // let a step-1 reasoning part authorise a step-2 signature.
        let sawReasoning = false;

        return {
          ...rest,
          stream: stream.pipeThrough(
            new TransformStream<LanguageModelV1StreamPart, LanguageModelV1StreamPart>({
              transform(part, controller) {
                if (part.type === 'reasoning') {
                  sawReasoning = true;
                } else if (part.type === 'reasoning-signature') {
                  // The orphan that kills the response. Drop it and carry on;
                  // the visible answer is unaffected.
                  if (!sawReasoning) return;
                  sawReasoning = false;
                }
                controller.enqueue(part);
              },
            }),
          ),
        };
      },
    },
  });
}
