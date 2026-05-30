import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { API_BASE, getAuthHeader } from '@/lib/api';

export default function SettingsScreen() {
  const user = auth.currentUser;
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
      // Server-side (Admin SDK): wipes the user doc + all subcollections and the
      // auth user. Clients are blocked from deleting their own user doc.
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/api/account/delete`, { method: 'POST', headers });
      if (!res.ok) throw new Error(`status ${res.status}`);
      // Clear the now-orphaned local session → the (app) guard routes to Welcome.
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

        <View className="mt-auto gap-3">
          {/* Sign out */}
          <TouchableOpacity
            onPress={handleSignOut}
            disabled={deleting}
            activeOpacity={0.8}
            className="border border-border rounded-2xl py-4 items-center"
          >
            <Text className="text-text font-semibold">Sign Out</Text>
          </TouchableOpacity>

          {/* Delete account */}
          <TouchableOpacity
            onPress={confirmDelete}
            disabled={deleting}
            activeOpacity={0.8}
            className="border border-red-900/40 rounded-2xl py-4 items-center flex-row justify-center gap-2"
          >
            {deleting && <ActivityIndicator color="#f87171" size="small" />}
            <Text className="text-red-400 font-semibold">
              {deleting ? 'Deleting…' : 'Delete Account'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
