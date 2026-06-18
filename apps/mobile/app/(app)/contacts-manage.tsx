import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DetailHeader } from '@/components/DetailHeader';
import { useThemeColors } from '@/lib/theme';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';

type UserCategory = 'personal' | 'professional' | 'service' | 'excluded';

interface ContactDoc {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  userCategory?: UserCategory;
}

const CATEGORY_LABELS: Record<UserCategory, string> = {
  personal: 'Personal',
  professional: 'Professional',
  service: 'Service',
  excluded: 'Exclude from AI',
};

const CATEGORY_COLORS: Record<UserCategory, string> = {
  personal: '#3b82f6',
  professional: '#8b5cf6',
  service: '#f59e0b',
  excluded: '#ef4444',
};

export default function ContactsManageScreen() {
  const c = useThemeColors();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<ContactDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'contacts'));
      const items: ContactDoc[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ContactDoc, 'id'>) }));
      items.sort((a, b) => a.name.localeCompare(b.name));
      setContacts(items);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  async function setCategory(contact: ContactDoc, category: UserCategory | null) {
    if (!user?.uid) return;
    setSaving(contact.id);
    try {
      const ref = doc(db, 'users', user.uid, 'contacts', contact.id);
      if (category === null) {
        await updateDoc(ref, { userCategory: deleteField() });
      } else {
        await updateDoc(ref, { userCategory: category });
      }
      setContacts(prev => prev.map(c =>
        c.id === contact.id ? { ...c, userCategory: category ?? undefined } : c
      ));
    } catch { Alert.alert('Error', 'Failed to update. Try again.'); }
    finally { setSaving(null); }
  }

  function openPicker(contact: ContactDoc) {
    const current = contact.userCategory;
    const options: Array<{ text: string; onPress: () => void; style?: 'cancel' | 'destructive' }> = (
      Object.keys(CATEGORY_LABELS) as UserCategory[]
    ).map(cat => ({
      text: cat === current ? `${CATEGORY_LABELS[cat]} ✓` : CATEGORY_LABELS[cat],
      onPress: () => setCategory(contact, cat === current ? null : cat),
      style: cat === 'excluded' ? 'destructive' : undefined,
    }));
    if (current) {
      options.push({ text: 'Clear override (auto-detect)', onPress: () => setCategory(contact, null) });
    }
    options.push({ text: 'Cancel', onPress: () => {}, style: 'cancel' });
    Alert.alert(contact.name, current ? `Currently: ${CATEGORY_LABELS[current]}` : 'Auto-detected category', options);
  }

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q);
  });

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <DetailHeader title="Manage Contacts" />
      <View className="px-4 pt-2 pb-3">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search…"
          placeholderTextColor={c.muted}
          className="bg-surface border border-border rounded-xl px-4 py-3 text-text text-sm"
        />
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.brand} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View className="h-px bg-border mx-0 my-0" />}
          ListEmptyComponent={<Text className="text-muted text-center text-sm py-8">No contacts found</Text>}
          renderItem={({ item }) => {
            const sub = [item.company, item.email ?? item.phone].filter(Boolean).join(' · ');
            const isSaving = saving === item.id;
            const cat = item.userCategory;
            return (
              <TouchableOpacity
                onPress={() => !isSaving && openPicker(item)}
                activeOpacity={0.7}
                className="flex-row items-center gap-3 py-3.5"
              >
                <View className="flex-1 min-w-0">
                  <Text
                    className="text-text font-semibold text-[14px]"
                    numberOfLines={1}
                    style={cat === 'excluded' ? { textDecorationLine: 'line-through', opacity: 0.5 } : undefined}
                  >
                    {item.name}
                  </Text>
                  {!!sub && <Text className="text-muted text-xs" numberOfLines={1}>{sub}</Text>}
                </View>
                {isSaving ? (
                  <ActivityIndicator size="small" color={c.brand} />
                ) : cat ? (
                  <View
                    className="px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[cat] + '22' }}
                  >
                    <Text className="text-[11px] font-semibold" style={{ color: CATEGORY_COLORS[cat] }}>
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-muted text-[12px]">Auto</Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
      <Text className="text-muted text-[11px] text-center px-6 pb-4">
        Tap a contact to set its category. Changes apply to AI immediately.
      </Text>
    </SafeAreaView>
  );
}
