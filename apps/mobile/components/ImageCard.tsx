import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { cacheDirectory, writeAsStringAsync, downloadAsync, EncodingType } from 'expo-file-system/legacy';
import { Icon } from '@/components/Icon';
import { useThemeColors } from '@/lib/theme';
import { API_BASE, getAuthHeader } from '@/lib/api';

interface ImagePayload { prompt?: string; size?: string }

// Renders MODUS-generated images on mobile. Mirrors the web ImageCard: MODUS
// emits ```image {"prompt"}```; this auto-calls /api/generate/image and shows
// the result with Save (to Photos) + Regenerate. The server caches by prompt so
// reopening a chat returns the same persisted image without regenerating.
export function ImageCard({ raw }: { raw: string }) {
  const c = useThemeColors();
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [image, setImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const startedRef = useRef(false);

  let data: ImagePayload;
  try { data = JSON.parse(raw); } catch { data = { prompt: raw }; }
  const prompt = (data.prompt ?? '').trim();

  async function generate(force = false) {
    setStatus('loading');
    setError('');
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/api/generate/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ prompt, size: data.size, force }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(
          body.error === 'image_limit_reached' ? "You've hit today's image limit. Resets tomorrow."
          : body.error === 'subscription_required' ? 'Image generation is a paid feature.'
          : 'Could not generate the image. Try again.',
        );
        setStatus('error');
        return;
      }
      const { image: url } = await res.json() as { image: string };
      setImage(url);
      setStatus('done');
    } catch {
      setError('Network error. Try again.');
      setStatus('error');
    }
  }

  useEffect(() => {
    if (startedRef.current || !prompt) return;
    startedRef.current = true;
    void generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!image || saving) return;
    setSaving(true);
    try {
      const fileUri = `${cacheDirectory}modus-image-${Date.now()}.png`;
      if (image.startsWith('data:')) {
        await writeAsStringAsync(fileUri, image.split(',')[1] ?? '', { encoding: EncodingType.Base64 });
      } else {
        await downloadAsync(image, fileUri);
      }
      const MediaLibrary = await import('expo-media-library');
      const { status: perm } = await MediaLibrary.requestPermissionsAsync();
      if (perm !== 'granted') { Alert.alert('Photos access', 'Allow photo access to save the image.'); return; }
      await MediaLibrary.saveToLibraryAsync(fileUri);
      Alert.alert('Saved', 'Image saved to your Photos.');
    } catch {
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="border border-border rounded-2xl overflow-hidden bg-surface self-start" style={{ maxWidth: 280 }}>
      <View className="px-3 py-2 flex-row items-center gap-2 border-b border-border">
        <Icon name="auto-awesome" size={13} color={c.brand} />
        <Text className="text-muted text-xs flex-1" numberOfLines={1}>{prompt || 'Generated image'}</Text>
      </View>

      {status === 'loading' && (
        <View style={{ width: 280, height: 280 }} className="items-center justify-center bg-brand/5 gap-3">
          <ActivityIndicator color={c.brand} />
          <Text className="text-muted text-xs">Generating image…</Text>
        </View>
      )}

      {status === 'done' && image && (
        <>
          <Image source={{ uri: image }} style={{ width: 280, height: 280 }} resizeMode="cover" />
          <View className="px-3 py-2.5 flex-row items-center gap-4 border-t border-border">
            <TouchableOpacity onPress={save} disabled={saving} activeOpacity={0.7}>
              <Text className="text-brand text-xs font-semibold">{saving ? 'Saving…' : 'Save to Photos'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => generate(true)} activeOpacity={0.7}>
              <Text className="text-muted text-xs">Regenerate</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {status === 'error' && (
        <View style={{ width: 280, height: 200 }} className="items-center justify-center px-6 gap-3">
          <Text className="text-red-400 text-xs text-center">{error}</Text>
          <TouchableOpacity onPress={() => generate()} activeOpacity={0.7}>
            <Text className="text-brand text-xs font-semibold">Try again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
