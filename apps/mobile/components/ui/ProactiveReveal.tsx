import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';

/**
 * Entrance for MODUS's proactive cards (the "noticed / loose end / relationship"
 * observations). The card rises + scales in once, then a soft accent glow pulses
 * along its border on a slow ~8s loop — so the observation keeps gently raising
 * its hand and is catchable even when it starts below the fold (the entrance
 * alone fires off-screen and is missed). `accent` matches the card's accent
 * color; `delay` staggers a stack.
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
    // slow recurring attention pulse: brighten, fade, then a long rest, forever
    glow.value = withDelay(
      delay + 360,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 480, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 1100, easing: Easing.in(Easing.ease) }),
          withTiming(0, { duration: 6200 }), // rest before next pulse
        ),
        -1,
        false,
      ),
    );
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 12 }, { scale: 0.96 + enter.value * 0.04 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value * 0.85 }));

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
