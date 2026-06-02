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
 * Ambient backdrop. Matches web: two low-opacity brand-violet glows anchored
 * near the top (like the dashboard header orbs), so the body reads essentially
 * flat. Deliberately quiet — a hint of atmosphere, not a gradient wash. No blue
 * (that read as off-brand); brand-violet family only, both light and dark.
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
      { scale: 0.95 + p.value * 0.12 },
    ],
    opacity: 0.85 + p.value * 0.15,
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
  const S = Math.max(width, height) * 0.9;

  // Brand-violet family only, low opacity, both modes subtle (matches web's
  // header orbs: ~0.12–0.16 dark). Anchored top so the body stays flat.
  const c1 = dark ? 'rgba(124,58,237,0.13)' : 'rgba(124,58,237,0.08)';
  const c2 = dark ? 'rgba(167,139,250,0.10)' : 'rgba(167,139,250,0.07)';

  return (
    <View className="absolute inset-0 bg-bg" pointerEvents="none">
      <Blob color={c1} size={S} x={-S * 0.32} y={-S * 0.42} duration={20000} delay={0} drift={36} />
      <Blob color={c2} size={S * 0.7} x={width - S * 0.5} y={-S * 0.22} duration={26000} delay={1500} drift={30} />
    </View>
  );
}
