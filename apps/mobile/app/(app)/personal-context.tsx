import { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { DetailHeader } from '@/components/DetailHeader';
import { GradientButton } from '@/components/ui';
import { useThemeColors } from '@/lib/theme';
import { getSettings, saveSettings, currentUid, type UserSettings } from '@/lib/settings';

const STYLES: { key: string; label: string; desc: string }[] = [
  { key: 'direct', label: 'Direct', desc: 'Straight to the point, no fluff.' },
  { key: 'concise', label: 'Concise', desc: 'Short and efficient.' },
  { key: 'strategic', label: 'Strategic', desc: 'Big-picture, decision-focused.' },
  { key: 'coach', label: 'Coach', desc: 'Pushes you, asks questions.' },
  { key: 'supportive', label: 'Supportive', desc: 'Warm and encouraging.' },
  { key: 'custom', label: 'Custom', desc: 'Describe your own style.' },
];

export default function PersonalContextScreen() {
  const c = useThemeColors();
  const uid = currentUid();
  const [settings, setSettings] = useState<UserSettings>({});
  const [context, setContext] = useState('');
  const [style, setStyle] = useState('direct');
  const [customStyle, setCustomStyle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!uid) return;
    getSettings(uid).then(s => {
      setSettings(s);
      setContext(s.personalContext ?? '');
      setStyle(s.responseStyle ?? 'direct');
      setCustomStyle(s.customStyle ?? '');
    });
  }, [uid]);

  async function save() {
    if (!uid) return;
    setSaving(true);
    try {
      await saveSettings(uid, settings, {
        personalContext: context.trim(),
        responseStyle: style,
        customStyle: style === 'custom' ? customStyle.trim() : settings.customStyle,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <DetailHeader title="Personal context" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 18 }} showsVerticalScrollIndicator={false}>
          <View className="gap-2">
            <Text className="text-muted text-xs font-semibold uppercase tracking-wider">About you</Text>
            <Text className="text-muted text-sm leading-5">What should MODUS always know about you, your work, and your priorities?</Text>
            <TextInput
              value={context}
              onChangeText={setContext}
              multiline
              placeholder="e.g. I'm a founder building a fitness marketplace. I care most about shipping fast and talking to users…"
              placeholderTextColor={c.muted}
              className="bg-surface border border-border rounded-2xl px-4 py-3.5 text-text text-[15px] leading-6"
              style={{ minHeight: 140, textAlignVertical: 'top' }}
            />
          </View>

          <View className="gap-2.5">
            <Text className="text-muted text-xs font-semibold uppercase tracking-wider">Response style</Text>
            {STYLES.map(s => {
              const active = style === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setStyle(s.key)}
                  activeOpacity={0.8}
                  className={`rounded-2xl px-4 py-3.5 border ${active ? 'bg-brand/10 border-brand/40' : 'bg-surface border-border'}`}
                >
                  <Text className={`font-bold text-[15px] ${active ? 'text-brand' : 'text-text'}`}>{s.label}</Text>
                  <Text className="text-muted text-xs mt-0.5">{s.desc}</Text>
                </TouchableOpacity>
              );
            })}
            {style === 'custom' && (
              <TextInput
                value={customStyle}
                onChangeText={setCustomStyle}
                multiline
                placeholder="Describe how MODUS should talk to you…"
                placeholderTextColor={c.muted}
                className="bg-surface border border-border rounded-2xl px-4 py-3.5 text-text text-[15px] leading-6"
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />
            )}
          </View>

          <GradientButton label="Save" icon="check" onPress={save} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
