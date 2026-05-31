import * as Haptics from 'expo-haptics';

/**
 * Thin, safe wrapper around expo-haptics. Every call is fire-and-forget and
 * swallows errors (older devices / simulators may not support haptics).
 */
export const haptics = {
  /** Light tap — selections, toggles on. */
  light: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  /** Medium tap — confirmations, sends. */
  medium: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); },
  /** Selection tick — moving through options. */
  select: () => { Haptics.selectionAsync().catch(() => {}); },
  /** Success buzz — completed an action (approve, complete). */
  success: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  /** Warning buzz — destructive / error. */
  warning: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); },
};
