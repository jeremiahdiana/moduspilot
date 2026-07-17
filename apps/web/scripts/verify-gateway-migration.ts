/**
 * Proves the Groq→Gateway move on the REAL code path, with a REAL completion.
 *
 * Why this exists: a wrong model id does NOT error. It falls through to
 * downgradedToFree() and the user is told a model answered that never ran. So the
 * only honest check is to resolve through the real resolveChatModel and then make
 * the model actually speak.
 *
 * Uses the real resolveChatModel / canonicalModelId / isModelUnlocked / PLATFORM_MODELS
 * and the real AI SDK. Needs AI_GATEWAY_API_KEY in .env.local.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-gateway-migration.ts
 */
import { generateText } from 'ai';
import { resolveChatModel, LLAMA_FALLBACK, isPremiumModel } from '../lib/chat/model';
import { canonicalModelId, isModelUnlocked, PLATFORM_MODELS } from '../lib/models';

const fails: string[] = [];
const check = (ok: boolean, label: string) => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}`);
  if (!ok) fails.push(label);
};

(async () => {
  console.log('1) The free floor points at the Gateway, not Groq:');
  check(LLAMA_FALLBACK === 'meta/llama-3.3-70b', `LLAMA_FALLBACK = ${LLAMA_FALLBACK}`);
  check(!JSON.stringify(PLATFORM_MODELS).includes('versatile'), 'no Groq ids left in the catalog');

  console.log('\n2) 🚨 EXISTING USERS: a saved Brain holding the Groq id still resolves.');
  console.log('   (Firestore stores a raw id with no backfill — without the alias every');
  console.log('    current Llama user gets a dead string in their switcher.)');
  check(canonicalModelId('llama-3.3-70b-versatile') === 'meta/llama-3.3-70b', 'llama-3.3-70b-versatile → meta/llama-3.3-70b');
  check(canonicalModelId('llama-3.1-8b-instant') === 'meta/llama-3.1-8b', 'llama-3.1-8b-instant → meta/llama-3.1-8b');
  check(isModelUnlocked('llama-3.3-70b-versatile', 'free'), 'the OLD id still passes the free plan gate');

  console.log('\n3) The free default is still free, and still promises nothing:');
  check(isPremiumModel('meta/llama-3.3-70b') === false, 'isPremiumModel(new id) === false — no false "downgraded" notice');
  check(isPremiumModel('llama-3.3-70b-versatile') === false, 'isPremiumModel(old id) === false — canonicalised first');

  console.log('\n4) resolveChatModel routes a free user to the Gateway:');
  const free = resolveChatModel({ plan: 'free' }, {});
  check(free.modelId === 'meta/llama-3.3-70b', `free user → ${free.modelId}`);
  check(free.downgraded === false, 'not flagged as a downgrade');

  console.log('\n5) A saved Brain with the OLD Groq id resolves through the same path:');
  const legacy = resolveChatModel({ plan: 'free', settings: { modelSettings: { model: 'llama-3.3-70b-versatile' } } }, {});
  check(legacy.modelId === 'meta/llama-3.3-70b', `saved 'llama-3.3-70b-versatile' → ${legacy.modelId}`);
  check(legacy.downgraded === false, 'silently NOT downgraded — the alias did its job');

  console.log('\n6) 🔴 THE ONLY CHECK THAT CANNOT BE FAKED — make it actually speak:');
  if (!process.env.AI_GATEWAY_API_KEY) {
    check(false, 'AI_GATEWAY_API_KEY missing — cannot round-trip');
  } else {
    const r = await generateText({ model: free.model, prompt: 'Reply with exactly: OK', maxTokens: 40 });
    check(r.text.trim().length > 0, `real completion: ${JSON.stringify(r.text.trim())} finish=${r.finishReason}`);
    check(r.finishReason === 'stop', 'finish=stop (not truncated — it is not a reasoner)');

    // memory.ts runs at maxTokens 80. gpt-oss (Groq's own suggested replacement)
    // returns '' here and would have killed long-term memory with no error.
    const tight = await generateText({ model: free.model, prompt: 'Reply with exactly: OK', maxTokens: 80 });
    check(tight.text.trim().length > 0, `survives memory.ts's maxTokens:80 → ${JSON.stringify(tight.text.trim())}`);
  }

  console.log('\n7) The added Gateway models route to THEMSELVES, not silently to Llama:');
  for (const id of ['meta/llama-4-maverick', 'deepseek/deepseek-v3.1']) {
    const r = resolveChatModel({ plan: 'modus' }, { modelId: id });
    check(r.modelId === id && !r.downgraded, `$24 user picks ${id} → served ${r.modelId}${r.downgraded ? ' (DOWNGRADED!)' : ''}`);
    // Missing from GATEWAY_HOSTED = matches no prefix = downgradedToFree() = Llama
    // answers while the chip names the model they picked. Silent, so assert it.
    if (process.env.AI_GATEWAY_API_KEY && r.modelId === id) {
      const out = await generateText({ model: r.model, prompt: 'Reply with exactly: OK', maxTokens: 80 });
      check(out.text.trim().length > 0 && out.finishReason === 'stop',
        `  …and it speaks at maxTokens 80: ${JSON.stringify(out.text.trim())} finish=${out.finishReason}`);
    }
  }
  // A free user must NOT get the paid additions.
  const gated = resolveChatModel({ plan: 'free' }, { modelId: 'deepseek/deepseek-v3.1' });
  check(gated.modelId === LLAMA_FALLBACK && gated.downgraded === true,
    'free user picking a $24 model → downgraded to Llama AND flagged (the notice fires)');

  console.log('\n8) Nobody wears the wrong company\'s logo:');
  const { logoForModel } = await import('../components/marketing/ModelLogos');
  const { OpenAILogo, MetaLogo, DeepSeekLogo } = await import('../components/marketing/ModelLogos');
  check(logoForModel('meta/llama-4-maverick') === MetaLogo, 'llama-4-maverick → MetaLogo');
  check(logoForModel('deepseek/deepseek-v3.1') === DeepSeekLogo, 'deepseek-v3.1 → DeepSeekLogo (was OpenAI\'s mark)');
  check(logoForModel('some/unknown-model') !== OpenAILogo, 'an unknown id does NOT fall back to OpenAI\'s mark');

  if (fails.length) {
    console.error(`\n❌ ${fails.length} FAILED:\n   - ${fails.join('\n   - ')}`);
    process.exit(1);
  }
  console.log('\n✅ all green — Llama survives Aug 16, existing users keep their Brain, and it speaks.');
})();
