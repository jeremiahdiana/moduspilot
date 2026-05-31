import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '@/components/Icon';
import { useDrawer } from '@/components/AppDrawer';

/** Shared top bar: hamburger (opens the drawer) + title + optional right slot. */
export function ScreenHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const { open } = useDrawer();
  return (
    <View className="px-4 py-3 flex-row items-center gap-2 border-b border-border">
      <TouchableOpacity onPress={open} activeOpacity={0.7} className="p-1.5 -ml-1 rounded-full">
        <Icon name="menu" tone="muted" size={26} />
      </TouchableOpacity>
      <Text className="text-lg font-black text-text flex-1" numberOfLines={1}>{title}</Text>
      {right}
    </View>
  );
}
