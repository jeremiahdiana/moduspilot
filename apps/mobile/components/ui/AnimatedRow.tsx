import Animated, { FadeIn } from 'react-native-reanimated';

export function AnimatedRow({ index = 0, children }: { index?: number; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeIn.duration(180)}>
      {children}
    </Animated.View>
  );
}
