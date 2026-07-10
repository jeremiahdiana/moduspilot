import { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { DetailHeader } from '@/components/DetailHeader';
import { GradientButton } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { ProviderLogo } from '@/components/BrandLogo';
import { useThemeColors } from '@/lib/theme';
import { getSettings, saveSettings, currentUid, type UserSettings } from '@/lib/settings';

type Provider = 'platform' | 'openai' | 'anthropic';

const TTS_VOICES: { id: string; name: string; desc: string }[] = [
  { id: 'onyx',    name: 'Onyx',    desc: 'Deep and authoritative — default for MODUS' },
  { id: 'alloy',   name: 'Alloy',   desc: 'Neutral and balanced' },
  { id: 'echo',    name: 'Echo',    desc: 'Warm and natural' },
  { id: 'fable',   name: 'Fable',   desc: 'Expressive and articulate' },
  { id: 'nova',    name: 'Nova',    desc: 'Clear and energetic' },
  { id: 'shimmer', name: 'Shimmer', desc: 'Soft and thoughtful' },
];

const BRAINS = [
  {
    id: 'auto',
    name: 'Auto',
    provider: 'MODUS routing',
    tagline: 'Best model for every task',
    desc: "MODUS routes each message to the model that'll do it best — Claude for writing and analysis, a reasoning model for code and math, real-time models for research, and fast Llama for everyday. Auto only uses the models your plan unlocks.",
    badge: 'Recommended',
    badgeClass: 'bg-brand text-white',
    plans: ['free', 'modus', 'pilot'],
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3',
    provider: 'Meta · Groq',
    tagline: 'Fast & always available',
    desc: 'Great for everyday tasks, brainstorming, and writing. Zero latency.',
    badge: 'Free',
    badgeClass: 'bg-emerald-500/10 text-emerald-400',
    plans: ['free', 'modus', 'pilot'],
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    tagline: 'Balanced & reliable',
    desc: "OpenAI's best multimodal model. Handles text, images, and complex reasoning.",
    badge: 'MODUS+',
    badgeClass: 'bg-violet-500/10 text-violet-400',
    plans: ['modus', 'pilot'],
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet',
    provider: 'Anthropic',
    tagline: 'Exceptional writing & analysis',
    desc: 'Best for nuanced writing, editing, and thorough analysis.',
    badge: 'MODUS+',
    badgeClass: 'bg-violet-500/10 text-violet-400',
    plans: ['modus', 'pilot'],
  },
  {
    id: 'claude-opus-4-8',
    name: 'Claude Opus',
    provider: 'Anthropic',
    tagline: 'Most capable',
    desc: "Anthropic's most intelligent model. For the hardest tasks.",
    badge: 'PILOT',
    badgeClass: 'bg-brand/10 text-brand',
    plans: ['pilot'],
  },
  {
    id: 'o4-mini',
    name: 'o4-mini',
    provider: 'OpenAI',
    tagline: 'Advanced reasoning',
    desc: "OpenAI's compact reasoning model. Math, code, logical problem-solving.",
    badge: 'PILOT',
    badgeClass: 'bg-brand/10 text-brand',
    plans: ['pilot'],
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    tagline: 'Multimodal powerhouse',
    desc: "Google's frontier model with massive context and strong multimodal abilities.",
    badge: 'PILOT',
    badgeClass: 'bg-brand/10 text-brand',
    plans: ['pilot'],
  },
  {
    id: 'grok-3',
    name: 'Grok 3',
    provider: 'xAI',
    tagline: 'Real-time knowledge',
    desc: "xAI's model trained on real-time data. Sharp reasoning and current information.",
    badge: 'PILOT',
    badgeClass: 'bg-brand/10 text-brand',
    plans: ['pilot'],
  },
];

const BYOK_PROVIDERS: { key: 'openai' | 'anthropic'; name: string; desc: string; models: { id: string; label: string; sub: string }[]; keyField: 'openaiKey' | 'anthropicKey'; placeholder: string }[] = [
  {
    key: 'openai',
    name: 'OpenAI',
    desc: 'Use your own OpenAI API key for full control over usage and billing.',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o', sub: 'Most capable' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', sub: 'Faster & lighter' },
    ],
    keyField: 'openaiKey',
    placeholder: 'sk-proj-…',
  },
  {
    key: 'anthropic',
    name: 'Anthropic',
    desc: 'Use your own Anthropic API key to power MODUS with Claude.',
    models: [
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', sub: 'Best quality' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', sub: 'Fastest' },
    ],
    keyField: 'anthropicKey',
    placeholder: 'sk-ant-…',
  },
];

export default function BrainScreen() {
  const c = useThemeColors();
  const uid = currentUid();
  const [settings, setSettings] = useState<UserSettings>({});
  const [plan, setPlan] = useState<'free' | 'modus' | 'pilot'>('free');
  const [saving, setSaving] = useState(false);
  const [ttsVoice, setTtsVoice] = useState('onyx');

  const [platformModel, setPlatformModel] = useState('auto');
  const [byokProvider, setByokProvider] = useState<'openai' | 'anthropic' | null>(null);
  const [byokModel, setByokModel] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');

  const isPaid = plan === 'modus' || plan === 'pilot';
  const isPilot = plan === 'pilot';

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      const p = snap.data()?.plan as string | undefined;
      setPlan(p === 'modus' || p === 'pilot' ? p : 'free');
    });
    getSettings(uid).then(s => {
      setSettings(s);
      if (s.ttsVoice) setTtsVoice(s.ttsVoice);
      const m = s.modelSettings;
      if (!m) return;
      if (m.provider === 'openai' || m.provider === 'anthropic') {
        setByokProvider(m.provider);
        const prov = BYOK_PROVIDERS.find(p => p.key === m.provider)!;
        setByokModel(m.model ?? prov.models[0].id);
      } else {
        const brain = BRAINS.find(b => b.id === m.model);
        setPlatformModel(brain?.id ?? 'auto');
      }
      setOpenaiKey(m.openaiKey ?? '');
      setAnthropicKey(m.anthropicKey ?? '');
    });
    return unsub;
  }, [uid]);

  function selectBrain(id: string, planList: string[]) {
    if (!planList.includes(plan)) return;
    setPlatformModel(id);
    setByokProvider(null);
  }

  function toggleByok(key: 'openai' | 'anthropic') {
    if (byokProvider === key) {
      setByokProvider(null);
    } else {
      setByokProvider(key);
      const prov = BYOK_PROVIDERS.find(p => p.key === key)!;
      setByokModel(prov.models[0].id);
    }
  }

  async function save() {
    if (!uid) return;
    setSaving(true);
    try {
      let ms: UserSettings['modelSettings'];
      if (byokProvider) {
        ms = {
          provider: byokProvider,
          model: byokModel,
          openaiKey: openaiKey.trim() || undefined,
          anthropicKey: anthropicKey.trim() || undefined,
        };
      } else {
        ms = { provider: 'platform', model: platformModel };
      }
      await saveSettings(uid, settings, { modelSettings: ms, ttsVoice });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const selectedByok = BYOK_PROVIDERS.find(p => p.key === byokProvider) ?? null;
  const keyValue = byokProvider === 'openai' ? openaiKey : anthropicKey;
  const setKeyValue = byokProvider === 'openai' ? setOpenaiKey : setAnthropicKey;
  const canSave = !byokProvider || keyValue.trim().length > 10;

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <DetailHeader title="Brain" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Platform Brains */}
          <View className="gap-3">
            <Text className="text-text font-semibold text-sm">Platform Brains</Text>
            {BRAINS.map(brain => {
              const locked = !brain.plans.includes(plan);
              const selected = !byokProvider && platformModel === brain.id;
              return (
                <TouchableOpacity
                  key={brain.id}
                  onPress={() => selectBrain(brain.id, brain.plans)}
                  activeOpacity={locked ? 1 : 0.8}
                  className={`rounded-2xl p-4 border ${
                    locked ? 'border-border bg-surface opacity-50' :
                    selected ? 'border-brand/50 bg-brand/5' : 'border-border bg-surface'
                  }`}
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="w-9 h-9 rounded-lg bg-surface-2 border border-border items-center justify-center">
                      {brain.id === 'auto'
                        ? <Icon name="auto-awesome" size={17} color={c.brand} />
                        : <ProviderLogo provider={brain.provider} size={18} />}
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-0.5 flex-wrap">
                        <Text className={`font-semibold text-sm ${selected ? 'text-brand' : 'text-text'}`}>{brain.name}</Text>
                        <Text className="text-muted text-xs">{brain.provider}</Text>
                        <View className={`px-2 py-0.5 rounded-full ${brain.badgeClass}`}>
                          <Text className={`text-[10px] font-semibold ${brain.badgeClass.split(' ')[1]}`}>{brain.badge}</Text>
                        </View>
                        {locked && (
                          <View className="px-2 py-0.5 rounded-full bg-surface-2 border border-border">
                            <Text className="text-muted text-[10px] font-semibold">
                              {brain.badge === 'PILOT' ? 'PILOT only' : 'Locked'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-muted text-xs font-medium mb-0.5">{brain.tagline}</Text>
                      <Text className="text-muted text-xs leading-4">{brain.desc}</Text>
                    </View>
                    {!locked && (
                      <View
                        className="shrink-0"
                        style={{
                          width: 16, height: 16, borderRadius: 8, borderWidth: 2,
                          borderColor: selected ? c.brand : c.border,
                          backgroundColor: selected ? c.brand : 'transparent',
                        }}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {!isPaid && (
              <Text className="text-muted text-xs text-center">
                Upgrade to <Text className="text-brand font-medium">MODUS</Text> to unlock GPT-4o and Claude Sonnet.{' '}
                <Text className="text-brand font-medium">PILOT</Text> unlocks all 7.
              </Text>
            )}
            {isPaid && !isPilot && (
              <Text className="text-muted text-xs text-center">
                Upgrade to <Text className="text-brand font-medium">PILOT</Text> to unlock Claude Opus, o4-mini, Gemini 2.5 Pro, and Grok 3.
              </Text>
            )}
          </View>

          {/* BYOK */}
          <View className="gap-3">
            <View className="gap-0.5">
              <Text className="text-text font-semibold text-sm">Use your own subscription</Text>
              <Text className="text-muted text-xs">Have your own OpenAI or Anthropic key? It overrides your platform Brain.</Text>
            </View>
            {BYOK_PROVIDERS.map(p => {
              const active = byokProvider === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => toggleByok(p.key)}
                  activeOpacity={0.8}
                  className={`rounded-2xl p-4 border ${active ? 'border-brand/50 bg-brand/5' : 'border-border bg-surface'}`}
                >
                  <View className="flex-row items-center justify-between gap-4">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-0.5">
                        <Text className={`font-semibold text-sm ${active ? 'text-brand' : 'text-text'}`}>{p.name}</Text>
                        <View className="px-2 py-0.5 rounded-full bg-blue-500/10">
                          <Text className="text-blue-400 text-[10px] font-semibold">Your key</Text>
                        </View>
                      </View>
                      <Text className="text-muted text-xs leading-4">{p.desc}</Text>
                    </View>
                    <View
                      className="shrink-0"
                      style={{
                        width: 16, height: 16, borderRadius: 8, borderWidth: 2,
                        borderColor: active ? c.brand : c.border,
                        backgroundColor: active ? c.brand : 'transparent',
                      }}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* BYOK model picker */}
          {byokProvider && selectedByok && (
            <View className="bg-surface border border-border rounded-2xl p-4 gap-3">
              <Text className="text-text font-semibold text-sm">Model</Text>
              <View className="flex-row flex-wrap gap-2">
                {selectedByok.models.map(m => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setByokModel(m.id)}
                    className={`flex-1 p-3 rounded-xl border ${byokModel === m.id ? 'border-brand/50 bg-brand/5' : 'border-border'}`}
                  >
                    <Text className={`text-sm font-medium ${byokModel === m.id ? 'text-brand' : 'text-text'}`}>{m.label}</Text>
                    <Text className="text-muted text-xs mt-0.5">{m.sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* BYOK API key */}
          {byokProvider && selectedByok && (
            <View className="bg-surface border border-border rounded-2xl p-4 gap-3">
              <Text className="text-text font-semibold text-sm">{selectedByok.name} API Key</Text>
              <Text className="text-muted text-xs">Stored privately on your account. Only used to make requests on your behalf.</Text>
              <TextInput
                value={keyValue}
                onChangeText={setKeyValue}
                placeholder={selectedByok.placeholder}
                placeholderTextColor={c.muted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                className="bg-bg border border-border rounded-xl px-4 py-3 text-text text-[15px] font-mono"
              />
            </View>
          )}

          {/* TTS Voice */}
          <View className="gap-3">
            <View className="gap-0.5">
              <Text className="text-text font-semibold text-sm">MODUS Voice</Text>
              <Text className="text-muted text-xs">The voice MODUS uses to read your briefing aloud.</Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {TTS_VOICES.map(v => {
                const selected = ttsVoice === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => setTtsVoice(v.id)}
                    activeOpacity={0.8}
                    style={{ width: '47%' }}
                    className={`p-4 rounded-2xl border ${selected ? 'border-brand/50 bg-brand/5' : 'border-border bg-surface'}`}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className={`font-semibold text-sm ${selected ? 'text-brand' : 'text-text'}`}>{v.name}</Text>
                      <View
                        style={{
                          width: 14, height: 14, borderRadius: 7, borderWidth: 2,
                          borderColor: selected ? c.brand : c.border,
                          backgroundColor: selected ? c.brand : 'transparent',
                        }}
                      />
                    </View>
                    <Text className="text-muted text-xs leading-4">{v.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <GradientButton
            label={saving ? 'Saving…' : 'Save'}
            icon="check"
            onPress={save}
            loading={saving}
            disabled={!canSave || saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
