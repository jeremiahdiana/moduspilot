import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';

function Splash() {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <ActivityIndicator size="large" color="#7C3AED" />
    </View>
  );
}

export default function Index() {
  const { user, loading } = useAuth();
  // null = not yet checked, true/false = onboarding status for the current user
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setOnboarded(null); return; }
    let active = true;
    getDoc(doc(db, 'users', user.uid))
      .then(snap => { if (active) setOnboarded(snap.data()?.onboardingComplete === true); })
      .catch(() => { if (active) setOnboarded(false); });
    return () => { active = false; };
  }, [user]);

  if (loading) return <Splash />;
  if (!user) return <Redirect href="/(auth)/welcome" />;
  if (onboarded === null) return <Splash />; // waiting on the user-doc check
  return onboarded
    ? <Redirect href={'/(app)/dashboard' as never} />
    : <Redirect href="/onboarding" />;
}
