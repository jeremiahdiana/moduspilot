import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon, type IconName } from '@/components/Icon';
import { GRADIENTS } from '@/lib/theme';

/** Polished empty state: gradient icon medallion + title + subtitle. */
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
      <LinearGradient
        colors={GRADIENTS.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: 76, height: 76, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name={icon} color="#fff" size={36} />
      </LinearGradient>
      <View className="items-center gap-1.5">
        <Text className="text-text font-bold text-lg">{title}</Text>
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
