import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useThemeColors } from '@/lib/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Circular progress ring with a solid brand stroke (SVG), animated on mount via
 * reanimated. Flat by design — color is the single functional accent, no
 * decorative gradient. Used for goal completion.
 */
export function ProgressRing({
  progress,
  size = 64,
  stroke = 6,
  label,
}: {
  progress: number; // 0–100
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const c = useThemeColors();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, progress));

  const animated = useSharedValue(0);
  useEffect(() => {
    animated.value = withTiming(clamped, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [clamped]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animated.value / 100),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.surface2} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.brand}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text className="text-text font-display font-bold" style={{ fontSize: size * 0.26 }}>
          {label ?? `${Math.round(clamped)}%`}
        </Text>
      </View>
    </View>
  );
}
