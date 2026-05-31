import { View, ViewStyle, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useColorScheme } from 'nativewind';

/**
 * Frosted-glass surface using a real native blur (expo-blur), with a hairline
 * brand-tinted border and a faint translucent fill so it reads on any
 * background. The web app's panels use backdrop-blur; this is the RN equivalent.
 */
export function GlassView({
  children,
  style,
  intensity = 40,
  radius = 24,
}: {
  children?: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  radius?: number;
}) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <BlurView intensity={intensity} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: dark ? 'rgba(148,97,255,0.18)' : 'rgba(124,58,237,0.12)',
            backgroundColor: dark ? 'rgba(22,22,38,0.45)' : 'rgba(255,255,255,0.55)',
          },
        ]}
      />
      {children}
    </View>
  );
}

/** Padded frosted card. */
export function GlassCard({
  children,
  style,
  radius = 24,
  intensity = 40,
}: {
  children?: React.ReactNode;
  style?: ViewStyle;
  radius?: number;
  intensity?: number;
}) {
  return (
    <GlassView radius={radius} intensity={intensity} style={style}>
      <View style={{ padding: 16 }}>{children}</View>
    </GlassView>
  );
}
