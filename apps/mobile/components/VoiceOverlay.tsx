import { Modal, View, Text, Pressable } from 'react-native';
import { type SharedValue } from 'react-native-reanimated';
import { VoiceOrb } from './ui/VoiceOrb';
import { Icon } from './Icon';
import { useThemeColors } from '@/lib/theme';

/**
 * Full-screen "voice mode" — when the user is dictating, MODUS takes over the
 * screen as a living orb that breathes with their voice, rather than a tiny mic
 * button quietly recording. Tap the orb (or Done) to finish + transcribe, ✕ to
 * cancel. Driven entirely by the voice hook's state/level.
 */
export function VoiceOverlay({
  state,
  level,
  onStop,
  onCancel,
}: {
  state: 'idle' | 'recording' | 'transcribing';
  level: SharedValue<number>;
  onStop: () => void;
  onCancel: () => void;
}) {
  const c = useThemeColors();
  const visible = state !== 'idle';
  const recording = state === 'recording';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(8,8,12,0.94)', alignItems: 'center', justifyContent: 'center' }}>
        <Pressable onPress={onCancel} hitSlop={14} style={{ position: 'absolute', top: 60, right: 22, padding: 8 }}>
          <Icon name="close" size={26} tone="muted" />
        </Pressable>

        <Pressable onPress={recording ? onStop : undefined} disabled={!recording}>
          <VoiceOrb size={176} state={recording ? 'recording' : 'transcribing'} level={level} />
        </Pressable>

        <Text className="text-text text-xl font-semibold mt-12">{recording ? 'Listening…' : 'Thinking…'}</Text>
        <Text className="text-muted text-[13px] mt-2">
          {recording ? 'Speak, then tap the orb to finish' : 'Transcribing your voice'}
        </Text>

        {recording && (
          <Pressable
            onPress={onStop}
            style={{
              marginTop: 40,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 22,
              paddingVertical: 13,
              borderRadius: 999,
              backgroundColor: c.brand,
            }}
          >
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#fff' }} />
            <Text className="text-white font-semibold text-[15px]">Done</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}
