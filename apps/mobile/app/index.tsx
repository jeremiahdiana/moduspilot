import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return user ? <Redirect href="/(app)/chat" /> : <Redirect href="/(auth)/login" />;
}
