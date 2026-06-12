import { useEffect } from 'react';
import { Stack, Redirect, router, usePathname } from 'expo-router';
import { View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/hooks/useAuth';
import { DrawerProvider } from '@/components/AppDrawer';
import { AppBackground } from '@/components/AppBackground';
import { BrandLoader } from '@/components/ui';
import { SheetsProvider } from '@/components/ui/Sheets';
import { registerPush } from '@/lib/push';

// Main nav screens: instant swap — the drawer sliding is the only transition.
// Detail screens (goal/[id], billing, etc.) get the native iOS slide.
const MAIN_SCREENS = [
  'dashboard', 'briefing', 'chat', 'goals', 'reminders',
  'projects', 'settings', 'habits', 'tasks',
];

export default function AppLayout() {
  const { user, loading } = useAuth();

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
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
              animation: 'default', // native iOS slide for detail screens (goal/[id], billing, etc.)
            }}
          >
            {MAIN_SCREENS.map(name => (
              <Stack.Screen key={name} name={name} options={{ animation: 'none' }} />
            ))}
          </Stack>
        </View>
      </DrawerProvider>
    </SheetsProvider>
  );
}
