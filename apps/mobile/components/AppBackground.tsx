import { View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useColorScheme } from 'nativewind';

/**
 * Ambient mesh-gradient backdrop behind every app screen — two soft radial
 * brand glows over the themed background, mirroring the web app's blurred-blob
 * hero. Uses real SVG radial gradients (react-native-svg).
 */
export function AppBackground() {
  const { colorScheme } = useColorScheme();
  const { width, height } = useWindowDimensions();
  const dark = colorScheme === 'dark';

  return (
    <View className="absolute inset-0 bg-bg" pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="glowTop" cx="22%" cy="12%" r="55%">
            <Stop offset="0" stopColor="#7C3AED" stopOpacity={dark ? 0.22 : 0.12} />
            <Stop offset="1" stopColor="#7C3AED" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="glowBottom" cx="85%" cy="88%" r="55%">
            <Stop offset="0" stopColor={dark ? '#5DE6FF' : '#9461FF'} stopOpacity={dark ? 0.14 : 0.1} />
            <Stop offset="1" stopColor={dark ? '#5DE6FF' : '#9461FF'} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#glowTop)" />
        <Rect x="0" y="0" width={width} height={height} fill="url(#glowBottom)" />
      </Svg>
    </View>
  );
}
