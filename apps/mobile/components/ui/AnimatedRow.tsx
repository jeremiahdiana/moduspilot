import { View } from 'react-native';

// No entering animation — screens appear instantly with cached data.
// Entering animations on every list item on every mount caused JS thread
// overload during navigation. The drawer closing is the visual transition.
export function AnimatedRow({ index = 0, children }: { index?: number; children: React.ReactNode }) {
  return <View>{children}</View>;
}
