import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { API_BASE, getAuthHeader } from '@/lib/api';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon } from '@/components/Icon';
import { useThemeColors, useThemeToggle } from '@/lib/theme';

export default function SettingsScreen() {
  const user = auth.currentUser;
  const c = useThemeColors();
  const { isDark, setDark } = useThemeToggle();
  const [deleting, setDeleting] = useState(false);

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { signOut(auth); } },
    ]);
  }

  async function deleteAccount() {
    if (!auth.currentUser) return;
    setDeleting(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/api/account/delete`, { method: 'POST', headers });
      if (!res.ok) throw new Error(`status ${res.status}`);
      await signOut(auth);
    } catch {
      setDeleting(false);
      Alert.alert('Delete failed', 'Could not delete your account. Please try again.');
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and all goals, habits, tasks, conversations, and memories. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete everything', style: 'destructive', onPress: deleteAccount },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <ScreenHeader title="Settings" />

      <View className="flex-1 px-5 py-6 gap-4">
        {/* Account info */}
        <View className="bg-surface border border-border rounded-2xl p-4 flex-row items-center gap-3">
          <View className="w-12 h-12 rounded-full bg-brand/12 items-center justify-center">
            <Icon name="person" tone="brand" size={24} />
          </View>
          <View className="flex-1">
            <Text className="text-text font-semibold">{user?.displayName ?? 'User'}</Text>
            <Text className="text-muted text-sm">{user?.email ?? ''}</Text>
          </View>
        </View>

        {/* Appearance */}
        <View className="bg-surface border border-border rounded-2xl px-4 py-3 flex-row items-center gap-3">
          <Icon name={isDark ? 'dark-mode' : 'light-mode'} tone="muted" size={22} />
          <Text className="text-text font-medium flex-1">Dark mode</Text>
          <Switch
            value={isDark}
            onValueChange={setDark}
            trackColor={{ true: c.brand, false: c.border }}
            thumbColor="#ffffff"
            ios_backgroundColor={c.border}
          />
        </View>

        {/* Open web app */}
        <View className="bg-surface border border-border rounded-2xl p-4">
          <Text className="text-xs text-muted font-semibold uppercase tracking-wider mb-2">More settings</Text>
          <Text className="text-muted text-sm">
            Full settings (billing, connectors, memory) are available at{' '}
            <Text className="text-brand">moduspilot.com</Text>
          </Text>
        </View>

        <View className="mt-auto gap-3">
          {/* Sign out */}
          <TouchableOpacity
            onPress={handleSignOut}
            disabled={deleting}
            activeOpacity={0.8}
            className="border border-border rounded-2xl py-4 flex-row items-center justify-center gap-2"
          >
            <Icon name="logout" tone="text" size={20} />
            <Text className="text-text font-semibold">Sign Out</Text>
          </TouchableOpacity>

          {/* Delete account */}
          <TouchableOpacity
            onPress={confirmDelete}
            disabled={deleting}
            activeOpacity={0.8}
            className="border border-red-900/40 rounded-2xl py-4 items-center flex-row justify-center gap-2"
          >
            {deleting ? <ActivityIndicator color="#f87171" size="small" /> : <Icon name="delete-outline" color="#f87171" size={20} />}
            <Text className="text-red-400 font-semibold">{deleting ? 'Deleting…' : 'Delete Account'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
