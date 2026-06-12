import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing,
} from 'react-native-reanimated';

/**
 * Crossfades skeleton → content with no hard cut and no background flash.
 *
 * - Cache hit (loading=false on mount): renders content immediately, no animation.
 * - Cold start (loading=true on mount): skeleton shows as absoluteFill underlay,
 *   content fades in on top when loading becomes false, skeleton unmounts after.
 */
export function FadeReveal({
  loading,
  skeleton,
  children,
}: {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
}) {
  const [startedLoading] = useState(loading);
  const opacity = useSharedValue(startedLoading ? 0 : 1);
  const [skeletonMounted, setSkeletonMounted] = useState(startedLoading);

  useEffect(() => {
    if (!loading && startedLoading) {
      opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setSkeletonMounted)(false);
      });
    }
  }, [loading]);

  const contentStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: opacity.value,
  }));

  if (!startedLoading) {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  return (
    <View style={{ flex: 1 }}>
      {skeletonMounted && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {skeleton}
        </View>
      )}
      <Animated.View style={contentStyle}>
        {children}
      </Animated.View>
    </View>
  );
}
