import Animated, { FadeIn } from 'react-native-reanimated';

// Single fade-in on the content container. Fires once per navigation since
// main screens unmount/remount on router.replace(). One animation on the root
// is cheap — this masks first-render flash without the JS-thread burst that
// per-item entering animations cause.
export function ScreenFade({ children }: { children: React.ReactNode }) {
  return (
    <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(240)}>
      {children}
    </Animated.View>
  );
}
