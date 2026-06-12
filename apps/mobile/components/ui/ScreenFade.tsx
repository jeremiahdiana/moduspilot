import { useLayoutEffect } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated';

// Fade (220ms) + micro slide-up (280ms, Material emphasized decelerate).
// Fires once per navigation — single animation on root, not per list item.
export function ScreenFade({ children }: { children: React.ReactNode }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  useLayoutEffect(() => {
    opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
    translateY.value = withTiming(0, { duration: 300, easing: Easing.bezier(0.05, 0.7, 0.1, 1.0) });
  }, []);

  const style = useAnimatedStyle(() => ({
    flex: 1,
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
