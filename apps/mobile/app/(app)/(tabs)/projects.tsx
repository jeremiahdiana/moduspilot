import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { addDoc, updateDoc, deleteDoc, doc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useCollections';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon } from '@/components/Icon';
import { useSheets } from '@/components/ui/Sheets';
import { SkeletonList, SkeletonCard } from '@/components/Skeleton';
import { EmptyState, GradientButton, AnimatedRow, SwipeToDelete, ScreenFade, FadeReveal } from '@/components/ui';
import type { Project } from '@/lib/types';

function AISection() {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push('/(app)/(tabs)/chat' as never)}
      className="mb-2 bg-surface dark:bg-surface/70 border border-border dark:border-border/60 rounded-2xl px-4 py-3.5 flex-row items-center gap-3.5"
    >
      <View className="w-9 h-9 rounded-xl bg-brand/10 items-center justify-center">
        <Icon name="chat-bubble-outline" tone="brand" size={18} />
      </View>
      <Text className="text-text font-medium text-[15px] flex-1">Ask MODUS</Text>
      <Icon name="chevron-right" tone="muted" size={20} />
    </TouchableOpacity>
  );
}

export default function ProjectsScreen() {
  const { user } = useAuth();
  const { actionSheet, prompt } = useSheets();
  const { data: projects, loading } = useProjects(user?.uid);

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
    <ScreenFade>
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

      <FadeReveal
        loading={loading}
        skeleton={<SkeletonList count={5}><SkeletonCard /></SkeletonList>}
      >
        {projects.length === 0 ? (
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
          initialNumToRender={20}
          removeClippedSubviews={false}
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
      </FadeReveal>
      </SafeAreaView>
    </ScreenFade>
  );
}
