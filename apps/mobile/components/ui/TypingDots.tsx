import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useThemeColors } from '@/lib/theme';

function Dot({ delay, color }: { delay: number; color: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) }),
        ),
        -1,
      ),
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + v.value * 0.65,
    transform: [{ translateY: -v.value * 4 }],
  }));
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, style]} />;
}

/** Animated "MODUS is typing" indicator — three bouncing dots. */
export function TypingDots() {
  const c = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', height: 8 }}>
      <Dot delay={0} color={c.brand} />
      <Dot delay={160} color={c.brand} />
      <Dot delay={320} color={c.brand} />
    </View>
  );
}
