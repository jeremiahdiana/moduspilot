import { useEffect } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { GRADIENTS } from '@/lib/theme';

/**
 * Horizontal progress bar with the brand gradient fill, animated on mount.
 * Replaces the flat `bg-brand` bars on goals/habits.
 */
export function GradientProgressBar({ progress, height = 6 }: { progress: number; height?: number }) {
  const clamped = Math.max(0, Math.min(100, progress));
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(clamped, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [clamped]);

  const style = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View className="bg-surface-2 rounded-full overflow-hidden" style={{ height }}>
      <Animated.View style={[{ height: '100%' }, style]}>
        <LinearGradient
          colors={GRADIENTS.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, borderRadius: height }}
        />
      </Animated.View>
    </View>
  );
}
