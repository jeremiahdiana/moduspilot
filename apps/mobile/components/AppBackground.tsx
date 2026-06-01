import { View } from 'react-native';

/**
 * App backdrop. Deliberately flat — a single solid themed surface, no ambient
 * glows or mesh gradients. Decorative glows read as "marketing page", not
 * "productivity tool"; color is reserved for meaning (status, accent, actions).
 */
export function AppBackground() {
  return <View className="absolute inset-0 bg-bg" pointerEvents="none" />;
}
