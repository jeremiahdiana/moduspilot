import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/Icon';

/** Top bar for detail screens: back button + optional title + optional right slot. */
export function DetailHeader({ title, right }: { title?: string; right?: React.ReactNode }) {
  return (
    <View className="px-4 pt-2 pb-3 flex-row items-center gap-3">
      <TouchableOpacity
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/chat'))}
        activeOpacity={0.7}
        className="w-10 h-10 items-center justify-center rounded-2xl bg-surface border border-border"
      >
        <Icon name="arrow-back" tone="text" size={22} />
      </TouchableOpacity>
      {title ? (
        <Text className="text-xl font-black text-text flex-1 tracking-tight" numberOfLines={1}>{title}</Text>
      ) : (
        <View className="flex-1" />
      )}
      {right}
    </View>
  );
}
