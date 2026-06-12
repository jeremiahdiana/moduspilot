import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
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
const GOOGLE_IOS_CLIENT_ID =
  '208739557361-tl9n4r3t8gku6qcen09l4b0uscoo1c3m.apps.googleusercontent.com';

/**
 * Creates the user doc on first sign-in (onboardingComplete: false) and reports
 * whether the user still needs onboarding.
 */
async function ensureUserDoc(
  uid: string,
  displayName: string | null,
  email: string | null,
): Promise<{ needsOnboarding: boolean }> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: displayName ?? '',
      email: email ?? '',
      createdAt: serverTimestamp(),
      onboardingComplete: false,
    });
    return { needsOnboarding: true };
  }
  return { needsOnboarding: snap.data()?.onboardingComplete !== true };
}

/**
 * Shared Google + Apple sign-in logic. After a successful sign-in it routes new
 * users to the onboarding flow and returning users straight into the app.
 */
export function useAuthActions(opts?: {
  /**
   * If provided, called with the signed-in uid instead of the default routing.
   * Used by the onboarding flow to seed the collected answers after sign-in.
   */
  afterSignIn?: (uid: string) => Promise<void> | void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [, response, promptGoogleAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });

  function routeAfterSignIn(needsOnboarding: boolean) {
    if (needsOnboarding) router.replace('/onboarding');
    else router.replace('/(app)/(tabs)/briefing');
  }

  async function finishSignIn(uid: string, displayName: string | null, email: string | null) {
    const { needsOnboarding } = await ensureUserDoc(uid, displayName, email);
    if (opts?.afterSignIn) {
      await opts.afterSignIn(uid);
      return;
    }
    routeAfterSignIn(needsOnboarding);
  }

  useEffect(() => {
    if (response?.type === 'success' && response.authentication) {
      handleGoogleCredential(
        response.authentication.idToken,
        response.authentication.accessToken,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  async function handleGoogleCredential(
    idToken: string | null | undefined,
    accessToken: string | null | undefined,
  ) {
    if (!idToken && !accessToken) return;
    let signedIn = false;
    try {
      setLoading(true);
      const credential = GoogleAuthProvider.credential(idToken ?? null, accessToken ?? null);
      const result = await signInWithCredential(auth, credential);
      signedIn = true;
      await finishSignIn(result.user.uid, result.user.displayName, result.user.email);
    } catch (e: unknown) {
      setLoading(false);
      handleSignInError(e, signedIn);
    }
  }

  async function signInWithApple() {
    let signedIn = false;
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
      signedIn = true;
      const displayName = credential.fullName?.givenName
        ? `${credential.fullName.givenName} ${credential.fullName.familyName ?? ''}`.trim()
        : result.user.displayName;
      await finishSignIn(result.user.uid, displayName ?? null, result.user.email);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'ERR_REQUEST_CANCELED') { setLoading(false); return; }
      setLoading(false);
      handleSignInError(e, signedIn);
    }
  }

  // If Firebase auth already succeeded but a later step (Firestore write,
  // routing, seeding) threw, the user *is* signed in — just enter the app
  // instead of showing a misleading failure. Otherwise surface the real error.
  function handleSignInError(e: unknown, signedIn: boolean) {
    if (signedIn) {
      router.replace('/(app)/(tabs)/briefing');
      return;
    }
    const code = (e as { code?: string })?.code;
    const message = (e as { message?: string })?.message;
    Alert.alert('Sign in failed', [code, message].filter(Boolean).join('\n') || 'Please try again.');
  }

  return {
    loading,
    signInWithGoogle: () => promptGoogleAsync(),
    signInWithApple,
  };
}
