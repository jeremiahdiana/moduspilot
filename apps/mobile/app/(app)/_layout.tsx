import { useEffect } from 'react';
import { Stack, Redirect, router, usePathname } from 'expo-router';
import { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, cancelAnimation } from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/hooks/useAuth';
import { DrawerProvider } from '@/components/AppDrawer';
import { AppBackground } from '@/components/AppBackground';
import { BrandLoader } from '@/components/ui';
import { SheetsProvider } from '@/components/ui/Sheets';
import { registerPush } from '@/lib/push';
import { navSignal } from '@/lib/navSignal';

export default function AppLayout() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  const opacity = useSharedValue(1);

  // AppDrawer calls this the moment the user taps a nav item so the
  // current screen fades out before the route even changes — no dead gap.
  useEffect(() => {
    navSignal.register(() => {
      cancelAnimation(opacity);
      opacity.value = withTiming(0, { duration: 80 });
    });
  }, []);

  // Pure opacity fade-in once React has finished rendering the new screen.
  // No translateX — moving pixels while the JS thread is busy causes dropped
  // frames (choppiness). Opacity runs through Core Animation at 60/120fps.
  useEffect(() => {
    cancelAnimation(opacity);
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 180 });
  }, [pathname]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    if (!user) return;
    registerPush(user.uid);

    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as { type?: string } | undefined;
      router.replace(data?.type === 'checkin' ? '/(app)/chat' : '/(app)/briefing');
    });
    return () => sub.remove();
  }, [user]);

  if (loading) return <BrandLoader />;
  if (!user) return <Redirect href="/(auth)/welcome" />;

  return (
    <SheetsProvider>
      <DrawerProvider>
        <View className="flex-1 bg-bg">
          <AppBackground />
          <Animated.View style={[{ flex: 1 }, fadeStyle]}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
                animation: 'none',
              }}
            />
          </Animated.View>
        </View>
      </DrawerProvider>
    </SheetsProvider>
  );
}
