import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon } from '@/components/Icon';
import { SkeletonList, SkeletonHabitRow } from '@/components/Skeleton';
import { ScreenFade, FadeReveal } from '@/components/ui';
import { useThemeColors } from '@/lib/theme';
import { haptics } from '@/lib/haptics';

// Read-only mirror of Apple Notes — synced into Firestore users/{uid}/notes by the
// MODUS Desktop (Mac) app. Matches the web /notes page (list + search + tap-to-read).
interface Note {
  id: string;
  title: string;
  body: string;
  folder?: string | null;
  modifiedAt?: Date | null;
}

function relativeDate(d?: Date | null): string {
  if (!d) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotesScreen() {
  const { user } = useAuth();
  const c = useThemeColors();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(
      collection(db, 'users', user.uid, 'notes'),
      orderBy('modifiedAt', 'desc'),
      limit(300),
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setNotes(snap.docs.map(d => {
          const x = d.data();
          return {
            id: d.id,
            title: (x.title as string) ?? 'Untitled',
            body: (x.body as string) ?? '',
            folder: (x.folder as string) ?? null,
            modifiedAt: x.modifiedAt?.toDate?.() ?? null,
          };
        }));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [user]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return notes;
    return notes.filter(n =>
      n.title.toLowerCase().includes(s) || n.body.toLowerCase().includes(s)
    );
  }, [notes, search]);

  return (
    <ScreenFade>
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScreenHeader title="Notes" />

        <FadeReveal
          loading={loading}
          skeleton={<SkeletonList count={6}><SkeletonHabitRow /></SkeletonList>}
        >
          {notes.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <Icon name="sticky-note-2" tone="muted" size={40} />
              <Text className="text-text text-base font-medium mt-4">No notes synced yet</Text>
              <Text className="text-muted text-sm text-center mt-1.5 leading-relaxed">
                Open the MODUS Desktop app on your Mac and grant Full Disk Access to sync your Apple Notes here.
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Search */}
              <View className="flex-row items-center gap-2 mb-5 px-4 py-2.5 bg-surface dark:bg-surface/70 border border-border dark:border-border/60 rounded-xl">
                <Icon name="search" tone="muted" size={18} />
                <TextInput
                  className="flex-1 text-text text-[15px]"
                  placeholder={`Search ${notes.length} notes…`}
                  placeholderTextColor={c.muted}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                    <Icon name="close" tone="muted" size={18} />
                  </TouchableOpacity>
                )}
              </View>

              {filtered.length === 0 ? (
                <Text className="text-muted text-sm text-center py-10">No notes match “{search}”.</Text>
              ) : (
                <View className="gap-2">
                  {filtered.map(n => {
                    const open = openId === n.id;
                    return (
                      <View key={n.id} className="bg-surface dark:bg-surface/70 border border-border dark:border-border/60 rounded-2xl overflow-hidden">
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => { haptics.select(); setOpenId(open ? null : n.id); }}
                          className="px-4 py-3 flex-row items-start gap-3"
                        >
                          <View className="flex-1">
                            <View className="flex-row items-center gap-2 flex-wrap">
                              <Text className="text-[15px] font-medium text-text" numberOfLines={1}>{n.title}</Text>
                              {n.folder ? (
                                <View className="px-1.5 py-0.5 rounded-full bg-surface-2">
                                  <Text className="text-muted text-[10px] font-medium">{n.folder}</Text>
                                </View>
                              ) : null}
                            </View>
                            {!open && n.body ? (
                              <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                                {n.body.replace(/\n/g, ' ').slice(0, 140)}
                              </Text>
                            ) : null}
                          </View>
                          <Text className="text-muted text-[11px] mt-0.5">{relativeDate(n.modifiedAt)}</Text>
                        </TouchableOpacity>
                        {open && (
                          <View className="border-t border-border dark:border-border/60 px-4 pt-3 pb-4">
                            <Text className="text-text/90 text-sm leading-relaxed">{n.body}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}
        </FadeReveal>
      </SafeAreaView>
    </ScreenFade>
  );
}
