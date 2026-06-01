import { View, Text } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';

/** Polished empty state: flat brand-tinted icon medallion + title + subtitle. */
export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-10">
      <View className="w-[76px] h-[76px] rounded-2xl items-center justify-center bg-brand/10">
        <Icon name={icon} tone="brand" size={34} />
      </View>
      <View className="items-center gap-1.5">
        <Text className="text-text font-display font-bold text-lg">{title}</Text>
        <Text className="text-muted text-sm text-center leading-5">{subtitle}</Text>
      </View>
    </View>
  );
}

/** Small rounded count pill for screen headers (e.g. "3 active"). */
export function CountPill({ label }: { label: string }) {
  return (
    <View className="px-3 py-1.5 rounded-full bg-surface border border-border">
      <Text className="text-muted text-xs font-semibold">{label}</Text>
    </View>
  );
}
