import Animated, { FadeInDown } from 'react-native-reanimated';

/**
 * Wraps a list row in a staggered fade-up entrance (reanimated). The delay is
 * capped so long lists don't take forever to finish animating in.
 */
export function AnimatedRow({ index = 0, children }: { index?: number; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(320)}>
      {children}
    </Animated.View>
  );
}
