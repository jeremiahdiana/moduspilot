import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import { Logo } from './Logo';
import { useThemeColors } from '@/lib/theme';

/**
 * MODUS loading state — not a spinner. The wing mark breathes with a soft glow
 * while radar pulse-rings emanate outward: MODUS is the all-in-one quietly
 * "reaching across" and monitoring everything for you. Reanimated only.
 */
function PulseRing({ delay, color }: { delay: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.ease) }), -1, false));
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.45 + p.value * 1.8 }],
    opacity: (1 - p.value) * 0.45,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: 104, height: 104, borderRadius: 52, borderWidth: 1.5, borderColor: color }, style]}
    />
  );
}

export function BrandLoader({ label }: { label?: string }) {
  const c = useThemeColors();
  const breathe = useSharedValue(0);
  useEffect(() => {
    breathe.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breathe.value * 0.07 }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.12 + breathe.value * 0.22, transform: [{ scale: 1 + breathe.value * 0.25 }] }));

  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center' }}>
        {/* soft breathing glow */}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: c.brand }, glowStyle]} />
        {/* radar pulses */}
        <PulseRing delay={0} color={c.brand} />
        <PulseRing delay={870} color={c.brand} />
        <PulseRing delay={1740} color={c.brand} />
        {/* wing mark */}
        <Animated.View style={logoStyle}>
          <Logo width={76} />
        </Animated.View>
      </View>
      {label ? <Text className="text-muted text-[13px] mt-2">{label}</Text> : null}
    </View>
  );
}
