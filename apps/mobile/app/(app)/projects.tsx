import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  collection, onSnapshot, query, orderBy,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon } from '@/components/Icon';
import { useSheets } from '@/components/ui/Sheets';
import { SkeletonList, SkeletonCard } from '@/components/Skeleton';
import { readCache, readCacheSync, writeCache } from '@/lib/cache';
import { EmptyState, GradientButton, AnimatedRow, SwipeToDelete } from '@/components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENTS } from '@/lib/theme';

function AISection() {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push('/(app)/chat' as never)}
      className="mt-2 mb-2 rounded-2xl overflow-hidden border border-brand/25"
    >
      <LinearGradient
        colors={['rgba(124,58,237,0.12)', 'rgba(139,92,246,0.06)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}
      >
        <LinearGradient
          colors={GRADIENTS.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="auto-awesome" color="#fff" size={20} />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text className="text-text font-bold text-[15px]">Ask MODUS</Text>
          <Text className="text-muted text-xs mt-0.5">Plan, prioritize, and break down your projects with AI</Text>
        </View>
        <Icon name="chevron-right" tone="muted" size={20} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

interface Project {
  id: string;
  title: string;
  description?: string;
  status: string;
  createdAt?: { toDate?: () => Date };
}

export default function ProjectsScreen() {
  const { user } = useAuth();
  const { actionSheet, prompt } = useSheets();
  const [projects, setProjects] = useState<Project[]>(() => readCacheSync<Project[]>(`projects.${user?.uid ?? ''}`) ?? []);
  const [loading, setLoading] = useState(() => !readCacheSync(`projects.${user?.uid ?? ''}`));

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let alive = true;

    readCache<Project[]>(`projects.${user.uid}`).then(cached => {
      if (alive && cached) { setProjects(cached); setLoading(false); }
    });

    const q = query(collection(db, 'users', user.uid, 'projects'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const next = snap.docs
        .map(d => ({
          id: d.id,
          title: d.data().title ?? 'Untitled',
          description: d.data().description,
          status: d.data().status ?? 'active',
        }))
        .filter(p => p.status === 'active');
      setProjects(next);
      setLoading(false);
      writeCache(`projects.${user.uid}`, next);
    }, () => setLoading(false));

    return () => { alive = false; unsub(); };
  }, [user]);

  async function addProject() {
    if (!user) return;
    const title = (await prompt({ title: 'New project', message: 'Give your project a name.', confirmLabel: 'Create' }))?.trim();
    if (!title) return;
    addDoc(collection(db, 'users', user.uid, 'projects'), {
      title, description: '', status: 'active', createdAt: serverTimestamp(),
    }).catch(() => Alert.alert('Error', 'Could not create the project.'));
  }

  function deleteProjectNow(p: Project) {
    if (!user) return;
    deleteDoc(doc(db, 'users', user.uid, 'projects', p.id)).catch(() => {});
  }

  function projectActions(p: Project) {
    if (!user) return;
    actionSheet({
      title: p.title,
      actions: [
        { label: 'Mark complete', onPress: () => updateDoc(doc(db, 'users', user.uid, 'projects', p.id), { status: 'done' }).catch(() => {}) },
        { label: 'Delete', destructive: true, onPress: () => deleteProjectNow(p) },
      ],
    });
  }

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <ScreenHeader
        title="Projects"
        right={
          <TouchableOpacity
            onPress={addProject}
            activeOpacity={0.8}
            className="w-10 h-10 rounded-xl bg-brand items-center justify-center"
          >
            <Icon name="add" color="#fff" size={24} />
          </TouchableOpacity>
        }
      />

      {loading ? (
        <SkeletonList count={5}>
          <SkeletonCard />
        </SkeletonList>
      ) : projects.length === 0 ? (
        <View className="flex-1">
          <View className="px-4"><AISection /></View>
          <View className="flex-1 items-center justify-center gap-4 px-10">
            <EmptyState
              icon="folder-open"
              title="No projects yet"
              subtitle="Group related work into a project. Tap + to create your first one."
            />
            <GradientButton label="New project" icon="add" onPress={addProject} />
          </View>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListHeaderComponent={<AISection />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <AnimatedRow index={index}>
            <SwipeToDelete onDelete={() => deleteProjectNow(item)}>
            <TouchableOpacity
              activeOpacity={0.8}
              onLongPress={() => projectActions(item)}
              onPress={() => router.push(`/(app)/project/${item.id}` as never)}
              className="bg-surface dark:bg-surface/70 border border-border dark:border-border/60 rounded-2xl px-4 py-4 flex-row items-center gap-3.5"
            >
              <View className="w-11 h-11 rounded-xl bg-brand/10 items-center justify-center">
                <Icon name="folder" tone="brand" size={22} />
              </View>
              <View className="flex-1">
                <Text className="text-text font-bold text-base" numberOfLines={1}>{item.title}</Text>
                {!!item.description && (
                  <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>{item.description}</Text>
                )}
              </View>
              <Icon name="more-horiz" tone="muted" size={20} />
            </TouchableOpacity>
            </SwipeToDelete>
            </AnimatedRow>
          )}
        />
      )}
    </SafeAreaView>
  );
}
