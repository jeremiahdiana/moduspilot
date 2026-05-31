import { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { DetailHeader } from '@/components/DetailHeader';
import { GradientButton } from '@/components/ui';
import { useThemeColors } from '@/lib/theme';
import { getSettings, saveSettings, currentUid, type UserSettings, type ModelSettings } from '@/lib/settings';

type Provider = ModelSettings['provider'];

const PROVIDERS: { key: Provider; label: string; note: string; models: string[] }[] = [
  { key: 'groq', label: 'Groq', note: 'Included — fast Llama 3.3 70B', models: ['llama-3.3-70b-versatile'] },
  { key: 'openai', label: 'OpenAI', note: 'Your API key', models: ['gpt-4o', 'gpt-4o-mini'] },
  { key: 'anthropic', label: 'Anthropic', note: 'Your API key', models: ['claude-sonnet-4-6', 'claude-haiku-4-5'] },
];

export default function ModelSettingsScreen() {
  const c = useThemeColors();
  const uid = currentUid();
  const [settings, setSettings] = useState<UserSettings>({});
  const [provider, setProvider] = useState<Provider>('groq');
  const [model, setModel] = useState('llama-3.3-70b-versatile');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!uid) return;
    getSettings(uid).then(s => {
      setSettings(s);
      const m = s.modelSettings;
      if (m) {
        setProvider(m.provider ?? 'groq');
        setModel(m.model ?? PROVIDERS.find(p => p.key === (m.provider ?? 'groq'))!.models[0]);
        setOpenaiKey(m.openaiKey ?? '');
        setAnthropicKey(m.anthropicKey ?? '');
      }
    });
  }, [uid]);

  function pickProvider(p: Provider) {
    setProvider(p);
    setModel(PROVIDERS.find(x => x.key === p)!.models[0]);
  }

  async function save() {
    if (!uid) return;
    setSaving(true);
    try {
      await saveSettings(uid, settings, {
        modelSettings: { provider, model, openaiKey: openaiKey.trim(), anthropicKey: anthropicKey.trim() },
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const active = PROVIDERS.find(p => p.key === provider)!;

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <DetailHeader title="Model" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 18 }} showsVerticalScrollIndicator={false}>
          <View className="gap-2.5">
            <Text className="text-muted text-xs font-semibold uppercase tracking-wider">Provider</Text>
            {PROVIDERS.map(p => {
              const sel = provider === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => pickProvider(p.key)}
                  activeOpacity={0.8}
                  className={`rounded-2xl px-4 py-3.5 border flex-row items-center justify-between ${sel ? 'bg-brand/10 border-brand/40' : 'bg-surface border-border'}`}
                >
                  <View>
                    <Text className={`font-bold text-[15px] ${sel ? 'text-brand' : 'text-text'}`}>{p.label}</Text>
                    <Text className="text-muted text-xs mt-0.5">{p.note}</Text>
                  </View>
                  {sel && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.brand }} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <View className="gap-2.5">
            <Text className="text-muted text-xs font-semibold uppercase tracking-wider">Model</Text>
            <View className="flex-row flex-wrap gap-2">
              {active.models.map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setModel(m)}
                  className={`px-3.5 py-2 rounded-xl border ${model === m ? 'bg-brand/10 border-brand/40' : 'bg-surface border-border'}`}
                >
                  <Text className={`text-xs font-semibold ${model === m ? 'text-brand' : 'text-muted'}`}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {provider === 'openai' && (
            <KeyField label="OpenAI API key" value={openaiKey} onChange={setOpenaiKey} placeholder="sk-…" muted={c.muted} />
          )}
          {provider === 'anthropic' && (
            <KeyField label="Anthropic API key" value={anthropicKey} onChange={setAnthropicKey} placeholder="sk-ant-…" muted={c.muted} />
          )}

          <GradientButton label="Save" icon="check" onPress={save} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function KeyField({ label, value, onChange, placeholder, muted }: {
  label: string; value: string; onChange: (s: string) => void; placeholder: string; muted: string;
}) {
  return (
    <View className="gap-2">
      <Text className="text-muted text-xs font-semibold uppercase tracking-wider">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={muted}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        className="bg-surface border border-border rounded-2xl px-4 py-3.5 text-text text-[15px]"
      />
      <Text className="text-muted text-xs">Stored on your account, used only for your requests.</Text>
    </View>
  );
}
