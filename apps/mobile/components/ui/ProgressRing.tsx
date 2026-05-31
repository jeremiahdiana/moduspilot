import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { GRADIENTS, useThemeColors } from '@/lib/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Circular progress ring with a brand gradient stroke (SVG), animated on mount
 * via reanimated. Used for the briefing day-score and goal completion.
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
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={GRADIENTS.ring[0]} />
            <Stop offset="0.5" stopColor={GRADIENTS.ring[1]} />
            <Stop offset="1" stopColor={GRADIENTS.ring[2]} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.surface2} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text className="text-text font-black" style={{ fontSize: size * 0.26 }}>
          {label ?? `${Math.round(clamped)}%`}
        </Text>
      </View>
    </View>
  );
}
