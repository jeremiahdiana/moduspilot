import { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { DetailHeader } from '@/components/DetailHeader';
import { GradientButton } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useThemeColors } from '@/lib/theme';
import { getSettings, saveSettings, currentUid, type UserSettings } from '@/lib/settings';

type Provider = 'platform' | 'openai' | 'anthropic';

const PLATFORM_MODELS = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'MODUS',
    tagline: 'Fast & Creative',
    desc: 'Great for brainstorming, writing, and everyday tasks. Instant responses.',
    badge: 'Default',
    badgeClass: 'bg-brand/10 text-brand',
  },
  {
    id: 'gpt-4o-mini',
    name: 'MODUS 2.0',
    tagline: 'Smarter & More Capable',
    desc: 'Deeper reasoning, sharper analysis, and more nuanced responses for complex work.',
    badge: 'Pro',
    badgeClass: 'bg-violet-500/10 text-violet-400',
    requiresPaid: true,
  },
];

const BYOK_PROVIDERS: { key: 'openai' | 'anthropic'; name: string; desc: string; models: { id: string; label: string; sub: string }[]; keyField: 'openaiKey' | 'anthropicKey'; placeholder: string }[] = [
  {
    key: 'openai',
    name: 'OpenAI',
    desc: 'Use your own OpenAI API key for full control over usage and billing.',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o', sub: 'Most capable' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', sub: 'Faster & cheaper' },
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

export default function ModelSettingsScreen() {
  const c = useThemeColors();
  const uid = currentUid();
  const [settings, setSettings] = useState<UserSettings>({});
  const [plan, setPlan] = useState<'free' | 'modus' | 'pilot'>('free');
  const [saving, setSaving] = useState(false);

  // Platform model selection
  const [platformModel, setPlatformModel] = useState('llama-3.3-70b-versatile');

  // BYOK state
  const [byokProvider, setByokProvider] = useState<'openai' | 'anthropic' | null>(null);
  const [byokModel, setByokModel] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');

  const isPaid = plan === 'modus' || plan === 'pilot';

  useEffect(() => {
    if (!uid) return;

    // Load plan directly from the user doc (not the settings sub-object)
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      const p = snap.data()?.plan as string | undefined;
      setPlan(p === 'modus' || p === 'pilot' ? p : 'free');
    });

    getSettings(uid).then(s => {
      setSettings(s);
      const m = s.modelSettings;
      if (!m) return;
      const byokKeys = ['openai', 'anthropic'];
      if (byokKeys.includes(m.provider)) {
        setByokProvider(m.provider as 'openai' | 'anthropic');
        setByokModel(m.model ?? BYOK_PROVIDERS.find(p => p.key === m.provider)!.models[0].id);
      } else {
        // platform or groq (legacy) → map to platform model
        const knownPlatform = PLATFORM_MODELS.find(pm => pm.id === m.model);
        setPlatformModel(knownPlatform?.id ?? 'llama-3.3-70b-versatile');
      }
      setOpenaiKey(m.openaiKey ?? '');
      setAnthropicKey(m.anthropicKey ?? '');
    });

    return unsub;
  }, [uid]);

  function selectPlatformModel(id: string) {
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
      await saveSettings(uid, settings, { modelSettings: ms });
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
      <DetailHeader title="AI Model" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* MODUS Models section */}
          <View className="gap-3">
            <Text className="text-text font-semibold text-sm">MODUS Models</Text>
            {PLATFORM_MODELS.map(m => {
              const locked = m.requiresPaid && !isPaid;
              const selected = !byokProvider && platformModel === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => !locked && selectPlatformModel(m.id)}
                  activeOpacity={locked ? 1 : 0.8}
                  className={`rounded-2xl p-5 border ${
                    locked ? 'border-border bg-surface opacity-60' :
                    selected ? 'border-brand/50 bg-brand/5' : 'border-border bg-surface'
                  }`}
                >
                  <View className="flex-row items-start justify-between gap-4">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                        <Text className={`font-semibold text-sm ${selected ? 'text-brand' : 'text-text'}`}>{m.name}</Text>
                        <View className={`px-2 py-0.5 rounded-full ${m.badgeClass}`}>
                          <Text className={`text-[10px] font-semibold ${m.badgeClass.split(' ')[1]}`}>{m.badge}</Text>
                        </View>
                        {locked && (
                          <View className="px-2 py-0.5 rounded-full bg-surface-2 border border-border">
                            <Text className="text-muted text-[10px] font-semibold">Upgrade to unlock</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-muted text-xs font-medium mb-0.5">{m.tagline}</Text>
                      <Text className="text-muted text-xs leading-4">{m.desc}</Text>
                    </View>
                    {!locked && (
                      <View
                        className="mt-0.5 shrink-0"
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
                Upgrade to <Text className="text-brand font-medium">MODUS</Text> to unlock model selection.
              </Text>
            )}
          </View>

          {/* BYOK section */}
          <View className="gap-3">
            <Text className="text-text font-semibold text-sm">Bring Your Own Key</Text>
            {BYOK_PROVIDERS.map(p => {
              const active = byokProvider === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => toggleByok(p.key)}
                  activeOpacity={0.8}
                  className={`rounded-2xl p-5 border ${active ? 'border-brand/50 bg-brand/5' : 'border-border bg-surface'}`}
                >
                  <View className="flex-row items-start justify-between gap-4">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1">
                        <Text className={`font-semibold text-sm ${active ? 'text-brand' : 'text-text'}`}>{p.name}</Text>
                        <View className="px-2 py-0.5 rounded-full bg-blue-500/10">
                          <Text className="text-blue-400 text-[10px] font-semibold">BYOK</Text>
                        </View>
                      </View>
                      <Text className="text-muted text-xs leading-4">{p.desc}</Text>
                    </View>
                    <View
                      className="mt-0.5 shrink-0"
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
            <View className="bg-surface border border-border rounded-2xl p-5 gap-3">
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
            <View className="bg-surface border border-border rounded-2xl p-5 gap-3">
              <Text className="text-text font-semibold text-sm">{selectedByok.name} API Key</Text>
              <Text className="text-muted text-xs">Stored privately on your account, only used to make requests on your behalf.</Text>
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
