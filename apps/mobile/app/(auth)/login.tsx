import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AuthButtons } from '@/components/AuthButtons';

export default function LoginScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 items-center justify-between px-8 py-12">
        {/* Logo */}
        <View className="flex-1 items-center justify-center">
          <Text className="text-5xl font-black text-brand tracking-widest mb-3">MODUS</Text>
          <Text className="text-xl font-bold text-text mt-2">Welcome back</Text>
          <Text className="text-base text-muted text-center mt-1">
            Sign in to pick up where you left off.
          </Text>
        </View>

        {/* Auth buttons */}
        <View className="w-full">
          <AuthButtons />

          <TouchableOpacity
            onPress={() => router.replace('/(auth)/welcome')}
            activeOpacity={0.7}
            className="mt-5 py-2"
          >
            <Text className="text-muted text-sm text-center">
              New to MODUS?{' '}
              <Text className="text-brand-light font-semibold">Create an account</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text className="text-muted/70 text-xs text-center mt-6 px-4 leading-5">
          By continuing you agree to our{' '}
          <Text className="text-muted">Terms of Service</Text> and{' '}
          <Text className="text-muted">Privacy Policy</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}
