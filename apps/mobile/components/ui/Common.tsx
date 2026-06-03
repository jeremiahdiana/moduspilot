import { View, Text, TouchableOpacity } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';

/**
 * Polished empty state: a haloed brand icon medallion + title + subtitle, with
 * an optional primary CTA so empty screens give the user a clear way forward
 * instead of a dead end.
 */
export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  action?: { label: string; icon?: IconName; onPress: () => void };
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-10">
      {/* soft halo behind the medallion adds depth vs. a flat tile */}
      <View className="items-center justify-center">
        <View className="absolute w-[104px] h-[104px] rounded-full bg-brand/5" />
        <View className="w-[76px] h-[76px] rounded-2xl items-center justify-center bg-brand/10 border border-brand/15">
          <Icon name={icon} tone="brand" size={34} />
        </View>
      </View>
      <View className="items-center gap-1.5">
        <Text className="text-text font-display font-bold text-lg">{title}</Text>
        <Text className="text-muted text-sm text-center leading-5">{subtitle}</Text>
      </View>
      {action ? (
        <TouchableOpacity
          onPress={action.onPress}
          activeOpacity={0.85}
          className="mt-1 flex-row items-center gap-2 px-5 py-3 rounded-2xl bg-brand"
        >
          {action.icon ? <Icon name={action.icon} color="#fff" size={18} /> : null}
          <Text className="text-white font-semibold text-[15px]">{action.label}</Text>
        </TouchableOpacity>
      ) : null}
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
