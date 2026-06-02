import { Image, ImageStyle, StyleProp } from 'react-native';
import { useColorScheme } from 'nativewind';

const LIGHT = require('@/assets/brand/logo.png');
const DARK = require('@/assets/brand/logo-dark.png');

/**
 * The MODUS wing mark (same asset as web). Theme-selected, transparent — drop
 * it in anywhere the brand glyph belongs (replaces the old plain "M" badges).
 * Source art is ~52×40, so height defaults to width × 0.78.
 */
export function Logo({ width = 44, height, style }: { width?: number; height?: number; style?: StyleProp<ImageStyle> }) {
  const { colorScheme } = useColorScheme();
  return (
    <Image
      source={colorScheme === 'dark' ? DARK : LIGHT}
      resizeMode="contain"
      style={[{ width, height: height ?? Math.round(width * 0.78) }, style]}
    />
  );
}
