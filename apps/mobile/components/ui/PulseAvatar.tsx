import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  cancelAnimation,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Logo } from './Logo';
import { useThemeColors } from '@/lib/theme';

/**
 * The assistant wing mark, alive. While MODUS is thinking/responding (`active`)
 * the mark breathes and soft radar rings emanate outward — the same "reaching
 * across / monitoring everything" language as BrandLoader, shrunk to chat scale.
 * Idle, it's just the static Logo. Rings draw outside the box (no clipping), so
 * the avatar column keeps its layout footprint.
 */
function Ring({ size, color, run }: { size: number; color: string; run: SharedValue<number> }) {
  // Begin just outside the mark (scale 1 = base diameter) and expand outward
  // only, so rings never ripple through the logo.
  const style = useAnimatedStyle(() => ({
    opacity: (1 - run.value) * 0.4,
    transform: [{ scale: 1 + run.value * 0.7 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
    >
      <Animated.View
        style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: color }, style]}
      />
    </Animated.View>
  );
}

export function PulseAvatar({ size = 26, active = false }: { size?: number; active?: boolean }) {
  const c = useThemeColors();
  const breathe = useSharedValue(0);
  const ringA = useSharedValue(0);
  const ringB = useSharedValue(0);

  useEffect(() => {
    if (active) {
      breathe.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, true);
      ringA.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }), -1, false);
      ringB.value = withDelay(1100, withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }), -1, false));
    } else {
      cancelAnimation(breathe);
      cancelAnimation(ringA);
      cancelAnimation(ringB);
      breathe.value = withTiming(0, { duration: 200 });
      ringA.value = 0;
      ringB.value = 0;
    }
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(ringA);
      cancelAnimation(ringB);
    };
  }, [active]);

  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breathe.value * 0.08 }] }));
  const box = size + 4;
  const ringBase = size + 9; // sits just outside the mark

  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      {active ? (
        <>
          <Ring size={ringBase} color={c.brand} run={ringA} />
          <Ring size={ringBase} color={c.brand} run={ringB} />
        </>
      ) : null}
      <Animated.View style={logoStyle}>
        <Logo width={size} opticalCenter />
      </Animated.View>
    </View>
  );
}
