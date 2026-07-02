import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { DetailHeader } from '@/components/DetailHeader';
import { Icon } from '@/components/Icon';
import { useThemeColors } from '@/lib/theme';
import { startCheckout, openBillingPortal } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import type { Plan } from '@/lib/types';

const TIERS: { key: Plan; name: string; price: string; tagline: string; features: string[] }[] = [
  { key: 'modus', name: 'MODUS', price: '$24/mo', tagline: '3 days free, then $24/mo · card required', features: ['Unlimited messages', 'All integrations', 'Proactive briefings'] },
  { key: 'pilot', name: 'PILOT', price: '$59/mo', tagline: 'For founders & executives · 3 days free', features: ['Everything in MODUS', 'Wearables, CRM, financial', 'Priority support'] },
];

export default function BillingScreen() {
  const c = useThemeColors();
  const [plan, setPlan] = useState<NonNullable<Plan>>('free');
  const [busy, setBusy] = useState<Plan | 'portal' | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid), snap => {
      const p = snap.data()?.plan as string | undefined;
      setPlan(p === 'modus' || p === 'pilot' ? p : 'free');
    });
  }, []);

  async function upgrade(target: 'modus' | 'pilot') {
    if (busy) return;
    haptics.medium();
    setBusy(target);
    try {
      const url = await startCheckout(target);
      await WebBrowser.openBrowserAsync(url);
      // Plan updates via the Stripe webhook; the onSnapshot above reflects it.
    } catch {
      Alert.alert('Checkout failed', 'Could not start checkout. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function manage() {
    if (busy) return;
    haptics.select();
    setBusy('portal');
    try {
      const url = await openBillingPortal();
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('No billing account', 'Upgrade to a paid plan first to manage billing.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <DetailHeader title="Billing" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
        <View className="gap-4">
          {TIERS.map(t => {
            const current = t.key === plan;
            const canUpgrade = (t.key === 'modus' || t.key === 'pilot') && t.key !== plan;
            return (
              <View
                key={t.key}
                className={`rounded-2xl border p-5 ${current ? 'border-brand bg-brand/10 dark:bg-brand/5' : 'border-border bg-surface'}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-text font-display font-bold text-lg">{t.name}</Text>
                  {current ? (
                    <View className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-brand/15 dark:bg-brand/10">
                      <View className="w-1.5 h-1.5 rounded-full bg-brand" />
                      <Text className="text-brand text-[11px] font-bold">Current</Text>
                    </View>
                  ) : (
                    <Text className="text-text font-semibold">{t.price}</Text>
                  )}
                </View>
                <Text className="text-muted text-[13px] mt-1">{t.tagline}</Text>

                <View className="gap-1.5 mt-3">
                  {t.features.map((f, i) => (
                    <View key={i} className="flex-row items-center gap-2">
                      <Icon name="check" tone="brand" size={15} />
                      <Text className="text-text/90 text-[13px]">{f}</Text>
                    </View>
                  ))}
                </View>

                {canUpgrade && (
                  <TouchableOpacity
                    onPress={() => upgrade(t.key as 'modus' | 'pilot')}
                    disabled={!!busy}
                    activeOpacity={0.85}
                    className="mt-4 rounded-xl bg-brand py-3 items-center flex-row justify-center gap-2"
                  >
                    {busy === t.key ? <ActivityIndicator color="#fff" size="small" /> : (
                      <Text className="text-white font-semibold">{plan === 'free' ? `Start trial — ${t.name}` : `Switch to ${t.name}`}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {plan !== 'free' && (
            <TouchableOpacity
              onPress={manage}
              disabled={!!busy}
              activeOpacity={0.8}
              className="border border-border rounded-xl py-4 flex-row items-center justify-center gap-2 mt-1"
            >
              {busy === 'portal' ? <ActivityIndicator color={c.muted} size="small" /> : <Icon name="credit-card" tone="text" size={20} />}
              <Text className="text-text font-semibold">Manage billing</Text>
            </TouchableOpacity>
          )}

          <Text className="text-muted text-xs text-center px-4 leading-5 mt-1">
            Payments are handled securely by Stripe. Your plan updates automatically after checkout.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
