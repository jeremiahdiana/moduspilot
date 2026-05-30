import { View, Text, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthActions } from '@/hooks/useAuthActions';

function GoogleIcon() {
  return (
    <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1a1a2e' }}>G</Text>
    </View>
  );
}

export function AuthButtons({ afterSignIn }: { afterSignIn?: (uid: string) => Promise<void> | void }) {
  const { loading, signInWithGoogle, signInWithApple } = useAuthActions({ afterSignIn });

  return (
    <View className="w-full gap-3">
      <TouchableOpacity
        onPress={() => signInWithGoogle()}
        disabled={loading}
        activeOpacity={0.85}
        className="w-full bg-white rounded-2xl py-4 flex-row items-center justify-center gap-3"
        style={{ opacity: loading ? 0.6 : 1 }}
      >
        {loading ? (
          <ActivityIndicator color="#1a1a2e" size="small" />
        ) : (
          <>
            <GoogleIcon />
            <Text className="text-gray-800 font-semibold text-base">Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
          cornerRadius={16}
          style={{ width: '100%', height: 52 }}
          onPress={signInWithApple}
        />
      )}
    </View>
  );
}
