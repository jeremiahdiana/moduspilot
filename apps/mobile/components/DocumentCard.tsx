import { View, Text, TouchableOpacity, Share } from 'react-native';
import { Icon } from '@/components/Icon';
import { useThemeColors } from '@/lib/theme';
import { Markdown } from '@/components/Markdown';

interface DocPayload { title?: string; markdown?: string }

// Renders MODUS-generated documents on mobile. Web offers a one-click PDF via
// the browser print pipeline; on mobile (no print engine without a native
// module) we render the formatted document inline and offer native Share, so
// the user can send it to Notes/Files/Messages. True PDF export is web-only.
export function DocumentCard({ raw }: { raw: string }) {
  const c = useThemeColors();
  let data: DocPayload;
  try { data = JSON.parse(raw); } catch { data = { markdown: raw }; }
  const title = (data.title ?? 'Document').trim();
  const markdown = (data.markdown ?? '').trim();

  function share() {
    Share.share({ title, message: `${title}\n\n${markdown}` }).catch(() => {});
  }

  return (
    <View className="border border-border rounded-2xl overflow-hidden bg-surface self-start" style={{ maxWidth: 320 }}>
      <View className="px-4 py-3 flex-row items-center gap-2.5 border-b border-border">
        <View className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 items-center justify-center">
          <Icon name="description" size={16} color={c.brand} />
        </View>
        <Text className="text-text text-sm font-semibold flex-1" numberOfLines={1}>{title}</Text>
      </View>
      <View className="px-4 py-3">
        <Markdown text={markdown} />
      </View>
      <View className="px-4 py-2.5 border-t border-border">
        <TouchableOpacity onPress={share} activeOpacity={0.7} className="flex-row items-center gap-1.5">
          <Icon name="ios-share" size={14} color={c.brand} />
          <Text className="text-brand text-xs font-semibold">Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
