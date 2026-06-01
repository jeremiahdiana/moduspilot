import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';

/**
 * Living ambient backdrop — soft brand-tinted glows that slowly drift and
 * breathe behind every screen (think Gemini / iOS). Deliberately low-opacity
 * and slow so it reads as depth/atmosphere, not decoration. The shared
 * background persists across navigations, so screen switches feel continuous.
 */
function Blob({
  color, size, x, y, duration, delay, drift,
}: {
  color: string; size: number; x: number; y: number; duration: number; delay: number; drift: number;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x + (p.value - 0.5) * drift },
      { translateY: y + (p.value - 0.5) * drift },
      { scale: 0.9 + p.value * 0.25 },
    ],
    opacity: 0.7 + p.value * 0.3,
  }));
  return (
    <Animated.View style={[{ position: 'absolute', width: size, height: size }, style]} pointerEvents="none">
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="g" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill="url(#g)" />
      </Svg>
    </Animated.View>
  );
}

export function AppBackground() {
  const { colorScheme } = useColorScheme();
  const { width, height } = useWindowDimensions();
  const dark = colorScheme === 'dark';
  const S = Math.max(width, height) * 0.95;

  // Subtle in dark, a touch softer in light. Two brand-family hues for depth.
  const c1 = dark ? 'rgba(124,58,237,0.20)' : 'rgba(124,58,237,0.12)';
  const c2 = dark ? 'rgba(56,120,255,0.16)' : 'rgba(167,139,250,0.12)';

  return (
    <View className="absolute inset-0 bg-bg" pointerEvents="none">
      <Blob color={c1} size={S} x={-S * 0.28} y={-S * 0.22} duration={15000} delay={0} drift={90} />
      <Blob color={c2} size={S * 0.9} x={width - S * 0.62} y={height - S * 0.7} duration={19000} delay={1200} drift={80} />
    </View>
  );
}
