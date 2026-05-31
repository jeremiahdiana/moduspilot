import { View } from 'react-native';
import { useColorScheme } from 'nativewind';

/**
 * Subtle ambient backdrop behind every app screen. We can't use real blur or
 * radial gradients without extra native deps, so this approximates the soft
 * "mesh" look with a couple of large, very low-opacity brand glows over the
 * themed background color.
 */
export function AppBackground() {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  return (
    <View className="absolute inset-0 bg-bg" pointerEvents="none">
      <View
        style={{
          position: 'absolute', top: -160, left: -120, width: 360, height: 360,
          borderRadius: 360, backgroundColor: '#7C3AED', opacity: dark ? 0.1 : 0.05,
        }}
      />
      <View
        style={{
          position: 'absolute', bottom: -180, right: -120, width: 380, height: 380,
          borderRadius: 380, backgroundColor: dark ? '#5DE6FF' : '#9461FF', opacity: dark ? 0.06 : 0.04,
        }}
      />
    </View>
  );
}
