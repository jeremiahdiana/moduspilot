import { Tabs, Redirect } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAuth } from '@/hooks/useAuth';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Briefing: '☀️',
    Chat: '💬',
    Goals: '🎯',
    Habits: '🔥',
    Settings: '⚙️',
  };
  return (
    <View className="items-center gap-1">
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{icons[label]}</Text>
      <Text
        style={{ fontSize: 10, color: focused ? '#7C3AED' : '#6b6b80', fontWeight: focused ? '600' : '400' }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function AppLayout() {
  const { user, loading } = useAuth();

  // Guard: kick unauthenticated users (e.g. after sign-out) back to welcome.
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }
  if (!user) return <Redirect href="/(auth)/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0f',
          borderTopColor: '#1e1e2e',
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
        },
      }}
    >
      <Tabs.Screen
        name="briefing"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Briefing" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Chat" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Goals" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Habits" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
