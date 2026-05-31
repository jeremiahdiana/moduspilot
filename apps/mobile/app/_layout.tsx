import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from 'nativewind';
import * as SplashScreen from 'expo-splash-screen';
import { loadSavedTheme } from '@/lib/theme';
import '../global.css';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  useEffect(() => {
    loadSavedTheme().finally(() => SplashScreen.hideAsync());
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
