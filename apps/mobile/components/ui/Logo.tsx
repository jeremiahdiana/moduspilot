import { Image, ImageStyle, StyleProp } from 'react-native';
import { useColorScheme } from 'nativewind';

const LIGHT = require('@/assets/brand/logo.png');
const DARK = require('@/assets/brand/logo-dark.png');

/**
 * The wing mark's ink-mass sits ~8.1% left of its geometric center (dense loop
 * upper-left, wing thinning to the right). When the mark is placed concentric
 * inside a ring/circle (BrandLoader, PulseAvatar) the bounding-box center looks
 * off; nudge the art right by this fraction of its width to optically center.
 */
export const LOGO_OPTICAL_DX = 0.081;

/**
 * The MODUS wing mark (same asset as web). Theme-selected, transparent — drop
 * it in anywhere the brand glyph belongs (replaces the old plain "M" badges).
 * Source art is ~52×40, so height defaults to width × 0.78. Pass `opticalCenter`
 * when the mark stands alone inside a circle/ring so it reads centered.
 */
export function Logo({
  width = 44,
  height,
  style,
  opticalCenter,
}: {
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
  opticalCenter?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  return (
    <Image
      source={colorScheme === 'dark' ? DARK : LIGHT}
      resizeMode="contain"
      style={[
        { width, height: height ?? Math.round(width * 0.78) },
        opticalCenter ? { transform: [{ translateX: width * LOGO_OPTICAL_DX }] } : null,
        style,
      ]}
    />
  );
}
