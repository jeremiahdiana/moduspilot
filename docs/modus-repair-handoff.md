# MODUS repair handoff

## Product model

MODUS has three user-facing paths: Free, MODUS and PILOT. Free uses open models on a rolling five-hour allowance plus a weekly cap. Paid users can buy separate extra-limit packs. New paid purchases charge at checkout. Existing Stripe trials keep their original end date.

## Completed repairs

- ZeroGPT requests validate input, reject invalid provider scores and abort after ten seconds. The client prevents duplicate requests, cancels stale text checks and offers retry.
- Free users see live five-hour and weekly usage in Billing. Account listeners refresh usage and reset state when the signed-in user changes.
- Brain was split into Memory and Account. Memory controls remain available. Personal API keys remain supported under Account. Models stay selectable in chat, with a picker action to save the current choice for new chats.
- New checkout sessions no longer set trial periods. Checkout is idempotent for repeated intents and rejects invalid add-on quantities. Plan changes resolve the live plan subscription and preserve annual cadence.
- Add-on webhook reconciliation sums all live add-on quantities, so packs stack and cancel independently.
- Onboarding offers Free without a card, uses the shared theme preference, honors reduced motion and commits profile, habit and starter memories atomically to make retries safe.
- Chat and project or goal chat saves carry model choices and surface recoverable save failures. Regenerated replies are persisted even when message count does not change.

## Claude follow-up

Polish onboarding and its opening animation against the homepage palette. Keep the light default and black or ivory neutral surfaces. Remove lavender fills and purple glow washes from onboarding surfaces and startup decoration. Violet remains the interactive accent. Verify light, dark and reduced-motion states at mobile and desktop widths.

Review the authenticated flows visually for spacing and copy consistency. The local UI can reach the login wall without credentials, so authenticated browser verification still needs an account session.

## Verification

Run from `apps/web`:

```sh
npm run verify:repair
npm run type-check
npm run check-copy
```

`verify:repair` uses mocked Stripe, ZeroGPT, Firestore and React boundaries. It covers free and paid limits, UTC resets, model gates, checker timeouts, checkout without trials, idempotent checkout, annual plan changes, founder protection, stacked add-ons, onboarding retries, account switching, chat defaults and per-conversation model persistence.
