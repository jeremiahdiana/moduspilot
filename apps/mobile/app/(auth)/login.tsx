import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID =
  '208739557361-ed3r8sd4grqn01a3i2fnn3iupfu64mc6.apps.googleusercontent.com';
// Native iOS builds require their own OAuth client ID (the web one can't
// authorize the native flow). Created in Google Cloud Console for bundle
// com.moduspilot.app. Its reversed form is registered as a URL scheme in
// app.json so the OAuth redirect can return to the app.
const GOOGLE_IOS_CLIENT_ID =
  '208739557361-tl9n4r3t8gku6qcen09l4b0uscoo1c3m.apps.googleusercontent.com';

async function ensureUserDoc(uid: string, displayName: string | null, email: string | null) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: displayName ?? '',
      email: email ?? '',
      createdAt: serverTimestamp(),
      onboardingComplete: false,
    });
  }
}

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const [, response, promptGoogleAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success' && response.authentication) {
      handleGoogleCredential(response.authentication.idToken, response.authentication.accessToken);
    }
  }, [response]);

  async function handleGoogleCredential(idToken: string | null | undefined, accessToken: string | null | undefined) {
    if (!idToken && !accessToken) return;
    try {
      setLoading(true);
      const credential = GoogleAuthProvider.credential(idToken ?? null, accessToken ?? null);
      const result = await signInWithCredential(auth, credential);
      await ensureUserDoc(result.user.uid, result.user.displayName, result.user.email);
    } catch {
      Alert.alert('Sign in failed', 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    try {
      setLoading(true);
      const nonce = Math.random().toString(36).substring(2, 18);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce,
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) throw new Error('No identity token');

      const provider = new OAuthProvider('apple.com');
      const firebaseCredential = provider.credential({
        idToken: credential.identityToken,
        rawNonce: nonce,
      });

      const result = await signInWithCredential(auth, firebaseCredential);
      const displayName =
        credential.fullName?.givenName
          ? `${credential.fullName.givenName} ${credential.fullName.familyName ?? ''}`.trim()
          : result.user.displayName;
      await ensureUserDoc(result.user.uid, displayName ?? null, result.user.email);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign in failed', 'Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 items-center justify-between px-8 py-12">

        {/* Logo section */}
        <View className="flex-1 items-center justify-center">
          {/* Glow effect behind logo */}
          <View
            className="absolute rounded-full opacity-20"
            style={{
              width: 200,
              height: 200,
              backgroundColor: '#7C3AED',
              transform: [{ scaleY: 0.4 }],
              top: '50%',
              alignSelf: 'center',
              filter: 'blur(60px)',
            } as object}
          />

          <Text className="text-5xl font-black text-brand tracking-widest mb-3">
            MODUS
          </Text>
          <Text className="text-base text-muted text-center">
            Your AI chief of staff
          </Text>
        </View>

        {/* Auth buttons */}
        <View className="w-full gap-3">
          {/* Google */}
          <TouchableOpacity
            onPress={() => promptGoogleAsync()}
            disabled={loading}
            activeOpacity={0.8}
            className="w-full bg-brand rounded-2xl py-4 flex-row items-center justify-center gap-3"
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <GoogleIcon />
                <Text className="text-white font-semibold text-base">
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Apple — iOS only */}
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={16}
              style={{ width: '100%', height: 52, borderWidth: 1, borderColor: '#1e1e2e', borderRadius: 16 }}
              onPress={handleAppleSignIn}
            />
          )}
        </View>

        {/* Legal */}
        <Text className="text-xs text-muted text-center mt-6 px-4 leading-5">
          By continuing you agree to our{' '}
          <Text className="text-brand">Terms of Service</Text>
          {' '}and{' '}
          <Text className="text-brand">Privacy Policy</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

function GoogleIcon() {
  return (
    <View style={{ width: 20, height: 20 }}>
      <Text style={{ fontSize: 16 }}>G</Text>
    </View>
  );
}
