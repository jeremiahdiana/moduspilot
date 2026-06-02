import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

/**
 * Entrance for MODUS's proactive cards (the "noticed / loose end / relationship"
 * observations). The card rises + scales in, then a one-time accent glow pulses
 * along its border and fades — so a surfaced observation reads as MODUS *raising
 * its hand*, not static text. `accent` should match the card's accent color;
 * `delay` staggers a stack. Fires once on mount (no re-animate on data swaps).
 */
export function ProactiveReveal({
  children,
  delay = 0,
  accent = '#7C3AED',
  radius = 16,
}: {
  children: React.ReactNode;
  delay?: number;
  accent?: string;
  radius?: number;
}) {
  const enter = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    enter.value = withDelay(delay, withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) }));
    glow.value = withDelay(
      delay + 360,
      withSequence(
        withTiming(1, { duration: 420, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 1000, easing: Easing.in(Easing.ease) }),
      ),
    );
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 12 }, { scale: 0.96 + enter.value * 0.04 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <Animated.View style={cardStyle}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          glowStyle,
          {
            borderRadius: radius,
            borderWidth: 1.5,
            borderColor: accent,
            shadowColor: accent,
            shadowOpacity: 0.7,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      />
    </Animated.View>
  );
}
