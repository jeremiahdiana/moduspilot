import { useColorScheme, colorScheme as nwColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'modus.theme';

// JS-side palette for things that can't use className (icon color,
// placeholderTextColor, ActivityIndicator, gradients, status bar).
export const PALETTE = {
  light: {
    bg: '#EEECF6', text: '#0D0D14', muted: '#5A526E',
    brand: '#7C3AED', brandLight: '#A78BFA',
    border: '#D3CCE5', surface: '#FFFFFF', surface2: '#F6F4FC', white: '#FFFFFF',
  },
  dark: {
    bg: '#0A0A0F', text: '#E8E8F0', muted: '#6B6B80',
    brand: '#7C3AED', brandLight: '#A78BFA',
    border: '#1E1E2E', surface: '#111118', surface2: '#161626', white: '#FFFFFF',
  },
};

// Brand gradients (match the web app's tailwind/globals.css).
export const GRADIENTS = {
  brand: ['#8b5cf6', '#7c3aed', '#6d28d9'] as const,            // primary buttons
  headline: ['#a78bfa', '#7c3aed', '#c084fc', '#818cf8'] as const, // gradient text
  ring: ['#a78bfa', '#7c3aed', '#6d28d9'] as const,             // progress rings
};

export type ThemeName = 'light' | 'dark';

export function useThemeColors() {
  const { colorScheme } = useColorScheme();
  return PALETTE[colorScheme === 'dark' ? 'dark' : 'light'];
}

/**
 * Restore the saved theme on app launch. Defaults to DARK when nothing is
 * saved — matches the web app, which always starts dark (light is in-session
 * only). Without this, the app would follow the OS scheme and feel off-brand.
 */
export async function loadSavedTheme() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    nwColorScheme.set(v === 'light' ? 'light' : 'dark');
  } catch {
    nwColorScheme.set('dark');
  }
}

export async function persistTheme(name: ThemeName) {
  try { await AsyncStorage.setItem(KEY, name); } catch {}
}

/** Reactive light/dark toggle that also persists the choice. */
export function useThemeToggle() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  function setDark(dark: boolean) {
    const name: ThemeName = dark ? 'dark' : 'light';
    setColorScheme(name);
    persistTheme(name);
  }
  return { isDark, setDark };
}
