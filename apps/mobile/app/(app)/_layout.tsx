import { useEffect } from 'react';
import { Stack, Redirect, router, usePathname } from 'expo-router';
import { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/hooks/useAuth';
import { DrawerProvider } from '@/components/AppDrawer';
import { AppBackground } from '@/components/AppBackground';
import { BrandLoader } from '@/components/ui';
import { SheetsProvider } from '@/components/ui/Sheets';
import { registerPush } from '@/lib/push';

export default function AppLayout() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  const fade = useSharedValue(1);
  useEffect(() => {
    fade.value = 0;
    fade.value = withTiming(1, { duration: 120 });
  }, [pathname]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  // Register for push once signed in, and route notification taps to the
  // relevant screen (briefing by default, chat for check-ins).
  useEffect(() => {
    if (!user) return;
    registerPush(user.uid);

    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as { type?: string } | undefined;
      router.replace(data?.type === 'checkin' ? '/(app)/chat' : '/(app)/briefing');
    });
    return () => sub.remove();
  }, [user]);

  // Guard: kick unauthenticated users (e.g. after sign-out) back to welcome.
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
                // Instant swap (no cross-fade overlap); the wrapper fades the
                // incoming screen's content in over the persistent background.
                animation: 'none',
              }}
            />
          </Animated.View>
        </View>
      </DrawerProvider>
    </SheetsProvider>
  );
}
