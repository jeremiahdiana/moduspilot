import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '@/components/Icon';
import { useDrawer } from '@/components/AppDrawer';

/** Shared top bar: rounded hamburger button + large title + optional right slot. */
export function ScreenHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const { open } = useDrawer();
  return (
    <View className="px-4 pt-2 pb-3 flex-row items-center gap-3">
      <TouchableOpacity
        onPress={open}
        activeOpacity={0.7}
        className="w-10 h-10 items-center justify-center rounded-2xl bg-surface border border-border"
      >
        <Icon name="menu" tone="text" size={22} />
      </TouchableOpacity>
      <Text className="text-3xl font-black text-text flex-1 tracking-tight" numberOfLines={1}>{title}</Text>
      {right}
    </View>
  );
}
