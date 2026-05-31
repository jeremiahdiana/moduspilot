import { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle, useColorScheme } from 'react-native';

/**
 * Skeleton — pulsing placeholder block.
 * Uses an Animated opacity loop (no extra native deps). Honors theme via
 * a translucent neutral fill that reads on both light and dark backgrounds.
 */
export function Skeleton({
  width,
  height = 12,
  radius = 6,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const scheme = useColorScheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  const bg = scheme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';

  return (
    <Animated.View
      style={[
        { width: width ?? '100%', height, borderRadius: radius, backgroundColor: bg, opacity },
        style,
      ]}
    />
  );
}

/** A skeleton card matching a goal/project row (title + progress bar). */
export function SkeletonCard() {
  return (
    <View className="bg-surface border border-border rounded-2xl px-4 py-4 gap-2.5">
      <View className="flex-row items-start justify-between gap-3">
        <Skeleton width="55%" height={15} />
        <Skeleton width={36} height={12} />
      </View>
      <Skeleton height={6} radius={3} />
      <Skeleton width="30%" height={11} />
    </View>
  );
}

/** A skeleton row matching a habit item (icon dot + title). */
export function SkeletonHabitRow() {
  return (
    <View className="bg-surface border border-border rounded-2xl px-4 py-4 flex-row items-center gap-3">
      <Skeleton width={36} height={36} radius={18} />
      <View className="flex-1 gap-2">
        <Skeleton width="50%" height={14} />
        <Skeleton width="25%" height={11} />
      </View>
    </View>
  );
}

/** Repeats a skeleton element `count` times inside a padded list container. */
export function SkeletonList({
  count = 4,
  children,
}: {
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <View style={{ padding: 16, gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i}>{children}</View>
      ))}
    </View>
  );
}
