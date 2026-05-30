import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const FEATURES = [
  { icon: '✉️', title: 'Email, drafted & sent', desc: 'MODUS writes it, you approve in one tap.' },
  { icon: '📅', title: 'Calendar, managed', desc: 'Schedule and block time automatically.' },
  { icon: '🎯', title: 'Goals you hit', desc: 'Daily check-ins and accountability built in.' },
  { icon: '🧠', title: 'Memory that sticks', desc: 'Never repeat yourself again.' },
];

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingVertical: 24, justifyContent: 'space-between' }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View className="items-center mt-6">
          <Text className="text-5xl font-black text-brand tracking-widest mb-1">MODUS</Text>
          <Text className="text-muted text-[10px] tracking-[0.3em] uppercase font-semibold mb-6">pilot</Text>
          <Text className="text-3xl font-black text-text text-center leading-tight">
            Your AI chief{'\n'}of staff.
          </Text>
          <Text className="text-muted text-sm text-center mt-3 leading-relaxed px-2">
            Email, calendar, goals, habits, memory — MODUS runs all of it so you can focus on what matters.
          </Text>
        </View>

        {/* Feature grid */}
        <View className="flex-row flex-wrap justify-between mt-8" style={{ gap: 12 }}>
          {FEATURES.map(f => (
            <View
              key={f.title}
              className="bg-surface border border-border rounded-2xl p-4"
              style={{ width: '47%' }}
            >
              <Text className="text-2xl mb-2">{f.icon}</Text>
              <Text className="text-text text-xs font-semibold leading-snug">{f.title}</Text>
              <Text className="text-muted text-xs leading-snug mt-1">{f.desc}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View className="mt-8">
          <TouchableOpacity
            onPress={() => router.push('/onboarding')}
            activeOpacity={0.85}
            className="w-full bg-brand rounded-2xl py-4 items-center"
          >
            <Text className="text-white font-bold text-base">Get started →</Text>
          </TouchableOpacity>
          <Text className="text-muted text-xs text-center mt-3">
            30-day free trial · No credit card required
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.7}
            className="mt-5 py-2"
          >
            <Text className="text-muted text-sm text-center">
              Already have an account?{' '}
              <Text className="text-brand-light font-semibold">Sign in</Text>
            </Text>
          </TouchableOpacity>

          <Text className="text-muted/70 text-[11px] text-center mt-4 px-4 leading-4">
            By continuing you agree to our{' '}
            <Text className="text-muted">Terms</Text> and{' '}
            <Text className="text-muted">Privacy Policy</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
