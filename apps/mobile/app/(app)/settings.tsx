import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function SettingsScreen() {
  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut(auth);
        },
      },
    ]);
  }

  const user = auth.currentUser;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="px-5 py-3 border-b border-border">
        <Text className="text-xl font-black text-text">Settings</Text>
      </View>

      <View className="flex-1 px-5 py-6 gap-4">
        {/* Account info */}
        <View className="bg-surface border border-border rounded-2xl p-4 gap-1">
          <Text className="text-xs text-muted font-semibold uppercase tracking-wider">Account</Text>
          <Text className="text-text font-semibold mt-2">{user?.displayName ?? 'User'}</Text>
          <Text className="text-muted text-sm">{user?.email ?? ''}</Text>
        </View>

        {/* Open web app */}
        <View className="bg-surface border border-border rounded-2xl p-4">
          <Text className="text-xs text-muted font-semibold uppercase tracking-wider mb-3">More settings</Text>
          <Text className="text-muted text-sm">
            Full settings (billing, connectors, memory) are available at{' '}
            <Text className="text-brand">moduspilot.com</Text>
          </Text>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          onPress={handleSignOut}
          activeOpacity={0.8}
          className="mt-auto border border-red-900/40 rounded-2xl py-4 items-center"
        >
          <Text className="text-red-400 font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
