import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated';

// Fires on every tab focus (not just mount) so the animation plays on each navigation.
// Uses ease-in for opacity so the fade is ~50% visible when the drawer finishes closing,
// then snaps to full. Paired with navigate-first in AppDrawer for best effect.
export function ScreenFade({ children }: { children: React.ReactNode }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  useFocusEffect(
    useCallback(() => {
      opacity.value = 0;
      translateY.value = 8;
      // ease-in: starts slow so ~50% opacity when drawer closes (280ms into a 350ms anim)
      opacity.value = withTiming(1, { duration: 350, easing: Easing.bezier(0.4, 0, 1, 1) });
      translateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
    }, [])
  );

  const style = useAnimatedStyle(() => ({
    flex: 1,
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
