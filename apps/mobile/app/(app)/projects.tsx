import { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection, onSnapshot, query, orderBy,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon } from '@/components/Icon';
import { useThemeColors } from '@/lib/theme';

interface Project {
  id: string;
  title: string;
  description?: string;
  status: string;
  createdAt?: { toDate?: () => Date };
}

export default function ProjectsScreen() {
  const { user } = useAuth();
  const c = useThemeColors();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(collection(db, 'users', user.uid, 'projects'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setProjects(
        snap.docs
          .map(d => ({
            id: d.id,
            title: d.data().title ?? 'Untitled',
            description: d.data().description,
            status: d.data().status ?? 'active',
          }))
          .filter(p => p.status === 'active'),
      );
      setLoading(false);
    }, () => setLoading(false));
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
          <TouchableOpacity onPress={addProject} activeOpacity={0.7} className="p-1.5 rounded-full">
            <Icon name="add" tone="brand" size={26} />
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.brand} />
        </View>
      ) : projects.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Icon name="folder-open" tone="muted" size={44} />
          <Text className="text-text font-semibold text-base">No projects yet</Text>
          <Text className="text-muted text-sm text-center">
            Group related work into a project. Tap + to create your first one.
          </Text>
          <TouchableOpacity onPress={addProject} activeOpacity={0.85} className="mt-2 bg-brand rounded-2xl px-6 py-3">
            <Text className="text-white font-bold text-sm">New project</Text>
          </TouchableOpacity>
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
              onPress={() => projectActions(item)}
              className="bg-surface border border-border rounded-2xl px-4 py-4 flex-row items-center gap-3"
            >
              <View className="w-10 h-10 rounded-xl bg-brand/12 items-center justify-center">
                <Icon name="folder" tone="brand" size={20} />
              </View>
              <View className="flex-1">
                <Text className="text-text font-semibold text-[15px]" numberOfLines={1}>{item.title}</Text>
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
