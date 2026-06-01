import { View, ViewStyle } from 'react-native';
import { useThemeColors } from '@/lib/theme';

/**
 * Flat surface panel. Previously a frosted-glass blur; now a solid themed
 * surface with a hairline border — calmer and more "tool", less "marketing".
 * Props kept (radius/intensity) so existing call sites are unaffected;
 * `intensity` is intentionally ignored.
 */
export function GlassView({
  children,
  style,
  radius = 16,
}: {
  children?: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  radius?: number;
}) {
  const c = useThemeColors();
  return (
    <View
      style={[
        {
          borderRadius: radius,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Padded flat card. */
export function GlassCard({
  children,
  style,
  radius = 16,
}: {
  children?: React.ReactNode;
  style?: ViewStyle;
  radius?: number;
  intensity?: number;
}) {
  return (
    <GlassView radius={radius} style={style}>
      <View style={{ padding: 16 }}>{children}</View>
    </GlassView>
  );
}
