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
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENTS } from '@/lib/theme';
import { SkeletonList, SkeletonCard } from '@/components/Skeleton';
import { readCache, writeCache } from '@/lib/cache';
import { EmptyState, GradientButton } from '@/components/ui';

interface Project {
  id: string;
  title: string;
  description?: string;
  status: string;
  createdAt?: { toDate?: () => Date };
}

export default function ProjectsScreen() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

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

  function addProject() {
    if (!user) return;
    Alert.prompt('New project', 'Give your project a name.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Create',
        onPress: (text?: string) => {
          const title = text?.trim();
          if (!title) return;
          addDoc(collection(db, 'users', user.uid, 'projects'), {
            title, description: '', status: 'active', createdAt: serverTimestamp(),
          }).catch(() => Alert.alert('Error', 'Could not create the project.'));
        },
      },
    ]);
  }

  function projectActions(p: Project) {
    if (!user) return;
    Alert.alert(p.title, undefined, [
      {
        text: 'Mark complete',
        onPress: () => updateDoc(doc(db, 'users', user.uid, 'projects', p.id), { status: 'done' }).catch(() => {}),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteDoc(doc(db, 'users', user.uid, 'projects', p.id)).catch(() => {}),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <ScreenHeader
        title="Projects"
        right={
          <TouchableOpacity onPress={addProject} activeOpacity={0.8}>
            <LinearGradient
              colors={GRADIENTS.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="add" color="#fff" size={24} />
            </LinearGradient>
          </TouchableOpacity>
        }
      />

      {loading ? (
        <SkeletonList count={5}>
          <SkeletonCard />
        </SkeletonList>
      ) : projects.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-4 px-10">
          <EmptyState
            icon="folder-open"
            title="No projects yet"
            subtitle="Group related work into a project. Tap + to create your first one."
          />
          <GradientButton label="New project" icon="add" onPress={addProject} />
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onLongPress={() => projectActions(item)}
              onPress={() => router.push(`/(app)/project/${item.id}` as never)}
              className="bg-surface border border-border rounded-3xl px-4 py-4 flex-row items-center gap-3.5"
            >
              <LinearGradient
                colors={GRADIENTS.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="folder" color="#fff" size={22} />
              </LinearGradient>
              <View className="flex-1">
                <Text className="text-text font-bold text-base" numberOfLines={1}>{item.title}</Text>
                {!!item.description && (
                  <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>{item.description}</Text>
                )}
              </View>
              <Icon name="more-horiz" tone="muted" size={20} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
