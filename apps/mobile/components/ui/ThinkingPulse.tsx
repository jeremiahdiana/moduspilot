import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemeColors } from '@/lib/theme';

const COUNT = 4;
const SIGMA = 0.9; // width of the travelling highlight

/**
 * "MODUS is thinking" — not three independent bouncing dots but a single bright
 * highlight that sweeps left→right across the row, like a scan passing over the
 * brand. Coordinated and intentional; pairs with PulseAvatar's radar rings.
 */
function ScanDot({ index, head, color }: { index: number; head: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    'worklet';
    const d = index - head.value;
    const w = Math.exp(-(d * d) / (2 * SIGMA * SIGMA)); // 0..1, peak when head passes this dot
    return {
      opacity: 0.28 + w * 0.72,
      transform: [{ scale: 1 + w * 0.55 }, { translateY: -w * 2 }],
    };
  });
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, style]} />;
}

export function ThinkingPulse() {
  const c = useThemeColors();
  const head = useSharedValue(-1);

  useEffect(() => {
    // sweep from before the first dot to just past the last, then loop
    head.value = withRepeat(
      withTiming(COUNT, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', height: 8 }}>
      {Array.from({ length: COUNT }).map((_, i) => (
        <ScanDot key={i} index={i} head={head} color={c.brand} />
      ))}
    </View>
  );
}
