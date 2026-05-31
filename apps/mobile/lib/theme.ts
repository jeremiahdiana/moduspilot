import { useColorScheme, colorScheme as nwColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'modus.theme';

// JS-side palette for things that can't use className (icon color,
// placeholderTextColor, ActivityIndicator, gradients, status bar).
export const PALETTE = {
  light: {
    bg: '#FAF9FF', text: '#0D0D14', muted: '#645A7A',
    brand: '#7C3AED', brandLight: '#7C3AED',
    border: '#E2DCF4', surface: '#FFFFFF', surface2: '#F3EFFC', white: '#FFFFFF',
  },
  dark: {
    bg: '#0A0A0F', text: '#E8E8F0', muted: '#8B8BA0',
    brand: '#9461FF', brandLight: '#9461FF',
    border: '#1E1E2E', surface: '#0F0F1A', surface2: '#161626', white: '#FFFFFF',
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

/** Restore the saved theme on app launch (defaults to system if none saved). */
export async function loadSavedTheme() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') nwColorScheme.set(v);
  } catch {}
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
