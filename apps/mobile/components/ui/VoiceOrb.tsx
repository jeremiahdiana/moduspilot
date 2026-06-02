import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Logo } from './Logo';
import { useThemeColors } from '@/lib/theme';

/**
 * MODUS voice orb — the assistant made visible while you talk to it. A glowing
 * brand core with the wing mark at center, ringed by radar pulses, all breathing
 * with the live mic level (`level`, 0..1) while recording. In `transcribing` it
 * drops the mic input and pulses on a steady "thinking" cadence instead. Same
 * radar DNA as BrandLoader/PulseAvatar, scaled up to be the moment.
 */
function Layer({ children }: { children: React.ReactNode }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {children}
    </View>
  );
}

function RadarRing({ base, color, run, amp }: { base: number; color: string; run: SharedValue<number>; amp: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + run.value * 1.3 }],
    opacity: (1 - run.value) * (0.18 + amp.value * 0.4),
  }));
  return (
    <Layer>
      <Animated.View style={[{ width: base, height: base, borderRadius: base / 2, borderWidth: 1.5, borderColor: color }, style]} />
    </Layer>
  );
}

export function VoiceOrb({
  size = 170,
  state,
  level,
}: {
  size?: number;
  state: 'recording' | 'transcribing';
  level: SharedValue<number>;
}) {
  const c = useThemeColors();
  const breathe = useSharedValue(0);
  const think = useSharedValue(0);
  const r1 = useSharedValue(0);
  const r2 = useSharedValue(0);
  const r3 = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }), -1, true);
    think.value = withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }), -1, true);
    const spawn = () => withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.ease) }), -1, false);
    r1.value = spawn();
    r2.value = withDelay(870, spawn());
    r3.value = withDelay(1740, spawn());
  }, []);

  // Drive everything off one amplitude: live mic level while recording, a steady
  // breathing cadence while transcribing.
  const amp = useDerivedValue(
    () => (state === 'recording' ? level.value : 0.28 + think.value * 0.5),
    [state],
  );

  // The center (core + logo) stays CALM; the voice radiates OUTWARD — the outer
  // glow swells and an amplitude halo pushes out from the core edge with volume.
  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + amp.value * 0.6 + breathe.value * 0.08 }],
    opacity: 0.12 + amp.value * 0.34,
  }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + amp.value * 0.7 }],
    opacity: amp.value * 0.5,
  }));
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.value * 0.03 }],
    opacity: 0.82,
  }));

  const ringBase = size * 0.86;
  const coreSize = size * 0.62;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <RadarRing base={ringBase} color={c.brand} run={r1} amp={amp} />
      <RadarRing base={ringBase} color={c.brand} run={r2} amp={amp} />
      <RadarRing base={ringBase} color={c.brand} run={r3} amp={amp} />
      {/* soft outer glow — swells outward with the voice */}
      <Layer>
        <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.brand }, glowStyle]} />
      </Layer>
      {/* amplitude halo — a ring pushed out from the core edge by volume */}
      <Layer>
        <Animated.View style={[{ width: coreSize, height: coreSize, borderRadius: coreSize / 2, borderWidth: 2, borderColor: c.brandLight }, haloStyle]} />
      </Layer>
      {/* core disc — calm, steady */}
      <Layer>
        <Animated.View style={[{ width: coreSize, height: coreSize, borderRadius: coreSize / 2, backgroundColor: c.brand }, coreStyle]} />
      </Layer>
      {/* wing mark — static */}
      <Layer>
        <Logo width={size * 0.42} opticalCenter />
      </Layer>
    </View>
  );
}
