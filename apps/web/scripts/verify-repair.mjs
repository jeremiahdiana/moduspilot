/** Offline behavioral regression checks. No .env files or real service clients. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const root = process.cwd();
let checks = 0;
const test = async (name, run) => { await run(); checks++; console.log(`PASS ${name}`); };
const plain = value => JSON.parse(JSON.stringify(value));

// Compile the actual modules in isolation. Unmocked service imports fail closed.
function loader(mocks = {}, globals = {}) {
  const cache = new Map();
  const context = vm.createContext({
    console: { info() {}, log() {}, error() {}, warn() {} },
    Response, Request, Headers, AbortController, URL, TextEncoder, Date, setTimeout, clearTimeout,
    process: { env: { ZEROGPT_API_KEY: 'test-key', STRIPE_PRICE_MODUS: 'price_modus', STRIPE_PRICE_PILOT: 'price_pilot', STRIPE_PRICE_MODUS_ANNUAL: 'price_modus_annual', STRIPE_PRICE_PILOT_ANNUAL: 'price_pilot_annual', STRIPE_PRICE_LIMIT_ADDON: 'price_addon' } },
    fetch: () => { throw new Error('Unmocked network call'); }, ...globals,
  });
  function load(file) {
    file = path.resolve(root, file);
    if (!path.extname(file)) file += '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const localRequire = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === 'crypto' || name.startsWith('node:')) return require(name);
      if (['@/lib/firebase', '@/lib/firebase-admin', '@/lib/stripe'].includes(name)) throw new Error(`Unmocked service: ${name}`);
      if (name.startsWith('@/')) return load(name.slice(2));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
      throw new Error(`Unmocked dependency: ${name}`);
    };
    new vm.Script(`(function(require,module,exports){${source}\n})`, { filename: file }).runInContext(context)(localRequire, module, module.exports);
    return module.exports;
  }
  return load;
}
const load = loader();
const limits = load('lib/constants.ts');
const { planCeilings } = load('lib/plan.ts');
const { usageSnapshot, allowancePercent } = load('lib/usage.ts');
const { validateCheckText, parseCheckResult } = load('lib/ai-check.ts');
const { canUseModel } = load('lib/models.ts');
await test('free ceilings ignore add-ons; paid and group ceilings retain their allowance', () => {
  for (const plan of [undefined, 'free']) assert.deepEqual(plain(planCeilings({ plan, limitAddonQty: 20 })), { window: limits.FREE_WINDOW_LIMIT, weekly: limits.FREE_WEEKLY_LIMIT });
  assert.equal(planCeilings({ plan: 'modus', limitAddonQty: 2 }).window, limits.MODUS_WINDOW_LIMIT + 2 * limits.LIMIT_ADDON_WINDOW);
  assert.equal(planCeilings({ plan: 'pilot' }).window, planCeilings({ plan: 'group' }).window);
  assert.equal(planCeilings({ plan: 'modus', limitAddonQty: Infinity }).window, limits.MODUS_WINDOW_LIMIT);
});
await test('usage matches exact five-hour and UTC weekly boundaries', () => {
  const start = Date.parse('2026-09-13T20:00:00Z');
  const usage = { windowStart: start, windowTokens: 150000, tokenWeek: '2026-09-07', weeklyTokens: 450000 };
  assert.equal(allowancePercent(usageSnapshot(usage, start).windowCount, limits.FREE_WINDOW_LIMIT), 50);
  assert.equal(usageSnapshot(usage, start + limits.WINDOW_MS - 1).windowCount, 150000);
  assert.equal(usageSnapshot(usage, start + limits.WINDOW_MS).windowCount, 0);
  assert.equal(usageSnapshot(usage, Date.parse('2026-09-14T00:00:00Z')).weeklyCount, 0);
  assert.equal(usageSnapshot(usage, start).weekReset, Date.parse('2026-09-14T00:00:00Z'));
  assert.equal(allowancePercent(limits.FREE_WINDOW_LIMIT - 1, limits.FREE_WINDOW_LIMIT), 99.9);
  assert.equal(allowancePercent(limits.FREE_WINDOW_LIMIT, limits.FREE_WINDOW_LIMIT), 100);
});
await test('free model selection rejects every paid-only model', () => {
  for (const model of load('lib/models.ts').PLATFORM_MODELS) assert.equal(canUseModel(model.id, 'free'), model.plans.includes('free'));
});
await test('server gates and free usage meters agree at exhausted and reset boundaries', () => {
  const gate = loader({ '@/lib/firebase-admin': { adminDb: {} }, 'firebase-admin/firestore': { FieldValue: {} } })('lib/chat/limits.ts');
  const now = Date.now();
  const base = { windowStart: now, windowTokens: limits.FREE_WINDOW_LIMIT - 1, tokenWeek: gate.getWeekKey(), weeklyTokens: 0 };
  assert.equal(gate.enforceSubscriptionGate('u', base), null);
  assert.equal(gate.enforceSubscriptionGate('u', { ...base, windowTokens: limits.FREE_WINDOW_LIMIT }).status, 402);
  assert.equal(gate.enforceSubscriptionGate('u', { ...base, windowTokens: 0, weeklyTokens: limits.FREE_WEEKLY_LIMIT }).status, 402);
  assert.equal(gate.enforceSubscriptionGate('u', { ...base, windowStart: now - limits.WINDOW_MS - 1, windowTokens: limits.FREE_WINDOW_LIMIT }), null);
  assert.equal(gate.enforcePaidTokenLimit({ ...base, plan: 'modus', windowTokens: limits.MODUS_WINDOW_LIMIT, limitAddonQty: 1 }), null);
});
await test('checker validates input and rejects non-finite or out-of-range scores', () => {
  for (const input of [null, 42, {}, 'short', 'x'.repeat(20001)]) assert.ok('error' in validateCheckText(input));
  assert.equal(validateCheckText('  ' + 'a'.repeat(40) + '  ').text.length, 40);
  for (const pct of [NaN, Infinity, -1, 101, '50', undefined]) assert.equal(parseCheckResult({ data: { fakePercentage: pct } }), null);
  assert.deepEqual(plain(parseCheckResult({ data: { fakePercentage: 25 } })), { ai: .25, human: .75 });
});
const request = body => new Request('http://local/api', { method: 'POST', headers: { Authorization: 'Bearer fake', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
await test('checker route handles success, input failures and provider failures without network', async () => {
  let providerCalls = 0;
  const route = loader({ '@/lib/api-auth': { requireAuth: async () => ({ uid: 'test' }) } }, { fetch: async () => { providerCalls++; return Response.json({ data: { fakePercentage: 25 } }); } })('app/api/ai-check/route.ts');
  assert.equal((await route.POST(request({ text: 5 }))).status, 400);
  assert.equal((await route.POST(request({ text: 'short' }))).status, 422);
  assert.equal(providerCalls, 0);
  assert.deepEqual(await (await route.POST(request({ text: 'a'.repeat(40) }))).json(), { ai: .25, human: .75 });
  const bad = loader({ '@/lib/api-auth': { requireAuth: async () => ({ uid: 'test' }) } }, { fetch: async () => Response.json({ data: {} }) })('app/api/ai-check/route.ts');
  assert.equal((await bad.POST(request({ text: 'a'.repeat(40) }))).status, 502);
});
await test('checker upstream wait aborts at ten seconds and returns a retryable timeout', async () => {
  let fireTimer;
  const route = loader({ '@/lib/api-auth': { requireAuth: async () => ({ uid: 'test' }) } }, {
    setTimeout: (fn, ms) => { assert.equal(ms, 10000); fireTimer = fn; return 1; }, clearTimeout() {},
    fetch: async (_url, { signal }) => { fireTimer(); assert.equal(signal.aborted, true); throw new Error('aborted'); },
  })('app/api/ai-check/route.ts');
  const result = await route.POST(request({ text: 'a'.repeat(40) }));
  assert.equal(result.status, 504); assert.equal((await result.json()).error, 'timeout');
});

function billingFixture() {
  let livePlan = null;
  let account = {};
  let addonSubscriptions = [];
  let openSessions = [];
  let event;
  const creates = [], changes = [];
  const ref = { get: async () => ({ data: () => account }), set: async updates => { account = { ...account, ...updates }; } };
  const stripe = {
    checkout: { sessions: { list: async () => ({ data: openSessions }), create: async (params, opts) => { creates.push({ params, opts }); return { url: 'https://checkout.stripe.test/session' }; } } },
    subscriptions: { list: () => ({ async *[Symbol.asyncIterator]() { yield* addonSubscriptions; } }), update: async (id, args) => { changes.push({ id, args }); return livePlan; } },
    webhooks: { constructEvent: () => event },
  };
  const billing = {
    ensureUserDoc: async () => {}, resolveStripeCustomer: async () => 'cus_test',
    findLivePlanSubscription: async () => livePlan, customerIdsForUser: async () => ['cus_test'],
    stripeId: v => typeof v === 'string' ? v : v?.id,
    isAddonSubscription: sub => typeof sub?.metadata?.addon === 'string',
    isFoundingSubscription: (data, sub) => data?.founding === true || sub?.metadata?.founding === 'true',
    cadenceOfSubscription: sub => sub.items.data[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly',
  };
  const adminDb = { collection: () => ({ doc: () => ref }), runTransaction: async callback => callback({ get: async () => ({ data: () => account }), set: (_ref, updates) => { account = { ...account, ...updates }; } }) };
  const load = loader({ '@/lib/stripe': { stripe }, '@/lib/firebase-admin': { adminAuth: { verifyIdToken: async () => ({ uid: 'u', email: 'test@example.invalid' }) }, adminDb }, '@/lib/billing': billing, '@/lib/fcm-admin': { sendPushToUser: async () => {} }, 'firebase-admin/firestore': { FieldValue: { serverTimestamp: () => 'timestamp' } } });
  return { load, creates, changes, get account() { return account; }, set account(v) { account = v; }, set livePlan(v) { livePlan = v; }, set addons(v) { addonSubscriptions = v; }, set event(v) { event = v; }, set sessions(v) { openSessions = v; } };
}
const planSub = { id: 'sub_plan', status: 'active', metadata: { plan: 'modus' }, customer: 'cus_test', items: { data: [{ id: 'item_plan', price: { recurring: { interval: 'month' } } }] } };
await test('new monthly and annual checkout have no trial; existing plans cannot duplicate', async () => {
  const f = billingFixture(), route = f.load('app/api/stripe/checkout/route.ts');
  for (const cadence of ['monthly', 'annual']) {
    const response = await route.POST(request({ plan: 'modus', cadence, returnTo: 'dashboard' }));
    assert.equal(response.status, 200);
    const created = f.creates.at(-1);
    assert.equal(created.params.subscription_data.trial_period_days, undefined);
    assert.equal(created.params.subscription_data.trial_settings, undefined);
    assert.equal(created.params.metadata.cadence, cadence);
    assert.ok(created.params.cancel_url.endsWith('/onboarding?checkout=1'));
    assert.ok(created.opts.idempotencyKey);
  }
  f.livePlan = planSub;
  assert.equal((await route.POST(request({ plan: 'pilot' }))).status, 409);
  assert.equal(f.creates.length, 2);
});
await test('checkout reuses an open session and validates add-on eligibility and quantity', async () => {
  const f = billingFixture(), route = f.load('app/api/stripe/checkout/route.ts');
  assert.equal((await route.POST(request({ plan: 'limitAddon' }))).status, 400);
  f.livePlan = planSub;
  assert.equal((await route.POST(request({ plan: 'limitAddon', quantity: 1.5 }))).status, 400);
  assert.equal((await route.POST(request({ plan: 'limitAddon', quantity: 2 }))).status, 200);
  const created = f.creates[0].params;
  assert.equal(created.subscription_data.metadata.plan, undefined);
  assert.equal(created.line_items[0].quantity, 2);
  f.sessions = [{ metadata: created.metadata, url: 'https://checkout.stripe.test/existing' }];
  assert.deepEqual(await (await route.POST(request({ plan: 'limitAddon', quantity: 2 }))).json(), { url: 'https://checkout.stripe.test/existing' });
  assert.equal(f.creates.length, 1);
});
await test('plan changes use the live plan, preserve annual cadence and protect founders', async () => {
  const f = billingFixture(), route = f.load('app/api/stripe/change-plan/route.ts');
  f.account = { subscriptionId: 'sub_wrong_addon', plan: 'free' };
  f.livePlan = { ...planSub, items: { data: [{ id: 'item_plan', price: { recurring: { interval: 'year' } } }] } };
  assert.equal((await route.POST(request({ plan: 'pilot' }))).status, 200);
  assert.equal(f.changes[0].id, 'sub_plan');
  assert.equal(f.changes[0].args.items[0].price, 'price_pilot_annual');
  assert.equal(f.changes[0].args.trial_end, undefined);
  f.account = { founding: true };
  assert.equal((await route.POST(request({ plan: 'pilot' }))).status, 409);
  assert.equal(f.changes.length, 1);
});
await test('add-on webhook sums live packs, survives cancellation and grants nothing without a plan', async () => {
  const f = billingFixture(); f.livePlan = planSub;
  const addon = (id, quantity, status = 'active') => ({ id, status, customer: 'cus_test', metadata: { uid: 'u', addon: 'limits' }, items: { data: [{ quantity }] } });
  f.addons = [addon('a', 2), addon('b', 3), addon('past_due', 9, 'past_due')];
  f.event = { id: 'evt_test', type: 'customer.subscription.updated', data: { object: addon('a', 2) } };
  const route = f.load('app/api/webhooks/stripe/route.ts');
  const send = () => route.POST(new Request('http://local/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 'fake' }, body: '{}' }));
  assert.equal((await send()).status, 200); assert.equal(f.account.limitAddonQty, 5);
  f.addons = [addon('a', 2, 'canceled'), addon('b', 3)];
  assert.equal((await send()).status, 200); assert.equal(f.account.limitAddonQty, 3);
  f.livePlan = null;
  assert.equal((await send()).status, 200); assert.equal(f.account.limitAddonQty, 0);
});

await test('onboarding commits completion with its seeds atomically and retries without duplicates', async () => {
  let account = {}, fail = true, records = new Map();
  const firestore = {
    doc: (_db, ...parts) => parts.join('/'), serverTimestamp: () => 'timestamp',
    runTransaction: async (_db, callback) => {
      const writes = [];
      const result = await callback({ get: async () => ({ data: () => account }), set: (id, data) => writes.push([id, data]) });
      if (fail) throw new Error('offline');
      for (const [id, data] of writes) { records.set(id, data); if (id === 'users/u') account = { ...account, ...data }; }
      return result;
    },
  };
  const { seedOnboardingAccount } = loader({ 'firebase/firestore': firestore, '@/lib/firebase': { db: {} } })('lib/onboarding.ts');
  const answers = { name: 'Test', role: 'Student', age: '18-24', gender: 'Prefer not to say' };
  await assert.rejects(seedOnboardingAccount('u', answers)); assert.equal(account.onboardingComplete, undefined); assert.equal(records.size, 0);
  fail = false;
  assert.equal((await seedOnboardingAccount('u', answers)).length, 2); assert.equal(records.size, 4); assert.equal(account.onboardingComplete, true);
  assert.equal(account.settings.personalContext.includes('Prefer not'), false);
  assert.equal((await seedOnboardingAccount('u', answers)).length, 0); assert.equal(records.size, 4);
});

// Minimal deterministic hook driver exercises real async state transitions.
function hookDriver() {
  let slots = [], index = 0, effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) { const i = index++; if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, v => { slots[i].value = typeof v === 'function' ? v(slots[i].value) : v; }]; },
    useRef(initial) { const i = index++; return slots[i] ??= { current: initial }; },
    useEffect(fn, deps) { const i = index++; if (!same(slots[i]?.deps, deps)) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
    useCallback(fn) { return fn; },
    useMemo(fn) { return fn(); },
  };
  return { react, render(fn) { index = 0; const result = fn(); const queue = effects; effects = []; queue.forEach(f => f()); return result; }, unmount() { slots.forEach(s => s?.cleanup?.()); } };
}
await test('settings receives live free usage, clears another account and reports save failures', async () => {
  const driver = hookDriver(); const listeners = new Map(); const stopped = [];
  let rejectSave = false, saved;
  const firestore = {
    doc: (_db, ...p) => p.join('/'), collection: (_db, ...p) => p.join('/'),
    onSnapshot: (ref, next, error) => { listeners.set(ref, { next, error }); return () => stopped.push(ref); },
    setDoc: async (_ref, data) => { if (rejectSave) throw new Error('offline'); saved = data; },
  };
  const { useUserSettings } = loader({ react: driver.react, 'firebase/firestore': firestore, '@/lib/firebase': { db: {} } })('hooks/useUserSettings.ts');
  const userA = { uid: 'a' }, userB = { uid: 'b' };
  driver.render(() => useUserSettings(userA));
  listeners.get('users/a').next({ data: () => ({ plan: 'pilot', windowTokens: 12, settings: { personalContext: 'private A' } }) });
  listeners.get('users/a/memories').next({ docs: [] });
  assert.equal(driver.render(() => useUserSettings(userA)).plan, 'pilot');
  const switched = driver.render(() => useUserSettings(userB));
  assert.equal(switched.plan, 'free'); assert.equal(switched.settings.personalContext, ''); assert.equal(switched.usage.windowTokens, 0);
  assert.ok(stopped.includes('users/a'));
  listeners.get('users/b').next({ data: () => ({ windowTokens: 125 }) });
  listeners.get('users/b/memories').next({ docs: [] });
  let state = driver.render(() => useUserSettings(userB)); assert.equal(state.usage.windowTokens, 125);
  listeners.get('users/b').next({ data: () => ({ windowTokens: 200 }) });
  state = driver.render(() => useUserSettings(userB)); assert.equal(state.usage.windowTokens, 200);
  await state.saveSettings({ responseStyle: 'concise' }); assert.deepEqual(plain(saved), { settings: { responseStyle: 'concise' } });
  rejectSave = true; await assert.rejects(state.saveSettings({ responseStyle: 'formal' }));
  assert.match(driver.render(() => useUserSettings(userB)).error, /Could not save/);
  driver.unmount(); assert.ok(stopped.includes('users/b'));
});
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const button = (tree, label) => nodes(tree).find(n => n.type === 'button' && n.props.children === label);
await test('checker client prevents duplicate calls, discards stale text and allows retry after timeout', async () => {
  const driver = hookDriver(); let activeFetch, calls = 0, timer, timerMs;
  const mocks = { react: driver.react, 'react/jsx-runtime': jsx,
    'framer-motion': { motion: { div: 'div' }, AnimatePresence: 'presence' },
    '@/lib/firebase': { auth: { currentUser: { getIdToken: async () => 'fake' } } },
  };
  const Component = loader(mocks, {
    setTimeout: (fn, ms) => { timer = fn; timerMs = ms; return 1; }, clearTimeout() {},
    fetch: (_url, options) => { calls++; return new Promise((resolve, reject) => { activeFetch = { resolve, reject }; options.signal.addEventListener('abort', () => reject(new Error('aborted'))); }); },
  })('components/chat/AiCheckButton.tsx').default;
  let text = 'A'.repeat(50);
  const render = () => driver.render(() => Component({ text }));
  render();
  const firstButton = nodes(render()).find(n => n.type === 'button');
  const first = firstButton.props.onClick(); await new Promise(setImmediate);
  await firstButton.props.onClick(); assert.equal(calls, 1); assert.equal(timerMs, 12000);
  text = 'B'.repeat(50); render(); await first;
  assert.ok(nodes(render()).some(n => n.type === 'button'));
  const second = nodes(render()).find(n => n.type === 'button').props.onClick(); await new Promise(setImmediate);
  timer(); await second;
  assert.ok(button(render(), 'Retry'));
  const third = button(render(), 'Retry').props.onClick(); await new Promise(setImmediate);
  activeFetch.resolve(Response.json({ ai: .2, human: .8 })); await third;
  assert.equal(button(render(), 'Retry'), undefined);
  assert.ok(nodes(render()).some(n => n.props?.className?.includes('font-medium text-text')));
  driver.unmount();
});
await test('chat default action saves only the default and rejects paid models after downgrade', async () => {
  const driver = hookDriver(); let accountPlan = 'pilot', saved;
  const user = { uid: 'u' };
  const models = load('lib/models.ts').PLATFORM_MODELS;
  let value = models.find(m => !m.plans.includes('free')).id;
  const Component = loader({ react: driver.react, 'react/jsx-runtime': jsx,
    'framer-motion': { motion: { div: 'div', svg: 'svg', span: 'span' }, AnimatePresence: 'presence' },
    '@/components/marketing/ModelLogos': { logoForModel: () => 'logo' },
    '@/components/providers/AuthProvider': { useAuth: () => ({ user }) },
    '@/lib/firebase': { auth: { currentUser: user }, db: {} },
    'firebase/firestore': { doc: (_db, ...parts) => parts.join('/'), getDoc: async () => ({ data: () => ({ plan: accountPlan }) }), setDoc: async (_ref, data) => { saved = data; } },
  }, { document: { addEventListener() {}, removeEventListener() {} } })('components/chat/ModelSwitcher.tsx').default;
  const render = () => driver.render(() => Component({ value, onChange() { throw new Error('Default action changed the current conversation'); }, plan: 'pilot' }));
  nodes(render()).find(n => n.type === 'button').props.onClick();
  await button(render(), 'Use as default for new chats').props.onClick();
  assert.deepEqual(plain(saved), { settings: { modelSettings: { provider: 'platform', model: value } } });
  accountPlan = 'free'; saved = undefined;
  await button(render(), 'Use as default for new chats').props.onClick(); assert.equal(saved, undefined);
  driver.unmount();
});
await test('per-conversation model picks persist without changing another thread or account default', async () => {
  const driver = hookDriver(), writes = [];
  const { useConversationModel } = loader({ react: driver.react, '@/lib/firebase': { db: {} },
    'firebase/firestore': { doc: (_db, ...parts) => parts.join('/'), setDoc: async (ref, data) => writes.push({ ref, data }) },
  })('hooks/useConversationModel.ts');
  const model = load('lib/models.ts').PLATFORM_MODELS.find(m => m.plans.includes('free')).id;
  let state = driver.render(() => useConversationModel('u', 'a', undefined, { provider: 'platform', model }, 'free'));
  assert.equal(state.modelChoice, model);
  await state.handleModelChange('auto');
  assert.deepEqual(plain(writes[0]), { ref: 'users/u/conversations/a', data: { modelChoice: 'auto' } });
  state = driver.render(() => useConversationModel('u', 'b', undefined, { provider: 'platform', model }, 'free'));
  assert.equal(state.modelChoice, model);
  state = driver.render(() => useConversationModel('u', 'a', undefined, { provider: 'platform', model }, 'free'));
  assert.equal(state.modelChoice, 'auto');
});
console.log(`${checks} offline regression groups passed.`);
