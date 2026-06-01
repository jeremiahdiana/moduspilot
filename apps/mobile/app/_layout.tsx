import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from 'nativewind';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { loadSavedTheme } from '@/lib/theme';
import { FONT_MAP, setDefaultFontFamily } from '@/lib/fonts';
import '../global.css';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const [fontsLoaded] = useFonts(FONT_MAP);

  useEffect(() => {
    if (fontsLoaded) setDefaultFontFamily();
  }, [fontsLoaded]);

  useEffect(() => {
    if (!fontsLoaded) return;
    loadSavedTheme().finally(() => SplashScreen.hideAsync());
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
