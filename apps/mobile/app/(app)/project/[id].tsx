import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  doc, onSnapshot, updateDoc, deleteDoc, arrayUnion,
  collection, query, where, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { DetailHeader } from '@/components/DetailHeader';
import { Icon, type IconName } from '@/components/Icon';
import { useSheets } from '@/components/ui/Sheets';
import { useThemeColors } from '@/lib/theme';

interface Note { id: string; content: string; date: string; }
interface Resource { type: string; label?: string; url?: string; title?: string; }
interface Project {
  title: string;
  description?: string;
  status: string;
  resources: Resource[];
  notes: Note[];
}
interface ProjectTask { id: string; title: string; done: boolean; }

const RESOURCE_ICON: Record<string, IconName> = {
  github: 'code', notion: 'description', slack: 'tag', drive: 'folder', url: 'link',
};

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const c = useThemeColors();
  const { actionSheet, prompt, confirm } = useSheets();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);

  useEffect(() => {
    if (!user || !id) return;
    return onSnapshot(doc(db, 'users', user.uid, 'projects', id), snap => {
      const d = snap.data();
      if (!d) { setProject(null); return; }
      setProject({
        title: d.title ?? 'Untitled',
        description: d.description,
        status: d.status ?? 'active',
        resources: (d.resources as Resource[]) ?? [],
        notes: (d.notes as Note[]) ?? [],
      });
    });
  }, [user, id]);

  useEffect(() => {
    if (!user || !id) return;
    const q = query(collection(db, 'users', user.uid, 'tasks'), where('projectId', '==', id));
    return onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, title: d.data().title ?? 'Untitled', done: d.data().done ?? false })));
    });
  }, [user, id]);

  const ref = () => doc(db, 'users', user!.uid, 'projects', id!);

  async function editField(field: 'title' | 'description', label: string) {
    const text = await prompt({
      title: label,
      defaultValue: field === 'title' ? project?.title : project?.description,
      multiline: field === 'description',
    });
    if (text != null) updateDoc(ref(), { [field]: text.trim() }).catch(() => {});
  }

  async function addNote() {
    const content = (await prompt({ title: 'Add note', multiline: true, confirmLabel: 'Add' }))?.trim();
    if (!content) return;
    updateDoc(ref(), {
      notes: arrayUnion({ id: `${Date.now()}`, content, date: new Date().toISOString().slice(0, 10) }),
    }).catch(() => {});
  }

  async function addTask() {
    if (!user || !id) return;
    const title = (await prompt({ title: 'Add task', confirmLabel: 'Add' }))?.trim();
    if (!title) return;
    addDoc(collection(db, 'users', user.uid, 'tasks'), {
      title, done: false, projectId: id, createdAt: serverTimestamp(),
    }).catch(() => {});
  }

  function toggleTask(t: ProjectTask) {
    if (!user) return;
    updateDoc(doc(db, 'users', user.uid, 'tasks', t.id), { done: !t.done }).catch(() => {});
  }

  async function confirmDelete() {
    const ok = await confirm({ title: 'Delete project?', message: 'This permanently removes the project.', confirmLabel: 'Delete', destructive: true });
    if (ok) deleteDoc(ref()).then(() => router.back()).catch(() => {});
  }

  function menu() {
    actionSheet({
      title: project?.title ?? 'Project',
      actions: [
        { label: 'Edit title', onPress: () => editField('title', 'Edit title') },
        { label: 'Edit description', onPress: () => editField('description', 'Edit description') },
        project?.status === 'active'
          ? { label: 'Mark complete', onPress: () => updateDoc(ref(), { status: 'done' }).then(() => router.back()).catch(() => {}) }
          : { label: 'Reopen', onPress: () => updateDoc(ref(), { status: 'active' }).catch(() => {}) },
        { label: 'Delete', destructive: true, onPress: confirmDelete },
      ],
    });
  }

  if (!project) {
    return (
      <SafeAreaView className="flex-1" edges={['top']}>
        <DetailHeader />
        <View className="flex-1 items-center justify-center"><Text className="text-muted">Loading…</Text></View>
      </SafeAreaView>
    );
  }

  const doneCount = tasks.filter(t => t.done).length;

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <DetailHeader
        right={
          <TouchableOpacity onPress={menu} className="w-10 h-10 items-center justify-center rounded-2xl bg-surface border border-border">
            <Icon name="more-horiz" tone="text" size={22} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => editField('title', 'Edit title')} activeOpacity={0.7}>
          <Text className="text-text font-display font-bold text-3xl tracking-tight">{project.title}</Text>
          {tasks.length > 0 && <Text className="text-muted text-sm mt-1">{doneCount}/{tasks.length} tasks done</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => editField('description', 'Edit description')} activeOpacity={0.7} className="bg-surface border border-border rounded-xl p-4 gap-1.5">
          <Text className="text-muted text-xs font-semibold uppercase tracking-wider">Description</Text>
          <Text className={project.description ? 'text-text text-[15px] leading-6' : 'text-muted text-[15px]'}>
            {project.description || 'Tap to add a description…'}
          </Text>
        </TouchableOpacity>

        <Section title="Tasks" onAdd={addTask}>
          {tasks.length === 0 ? (
            <Text className="text-muted text-sm px-1 py-2">No tasks yet. Tap + to add one.</Text>
          ) : (
            tasks.map(t => (
              <TouchableOpacity key={t.id} onPress={() => toggleTask(t)} activeOpacity={0.7} className="flex-row items-center gap-3 py-2.5">
                <View
                  style={{
                    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                    borderColor: t.done ? c.brand : c.border, backgroundColor: t.done ? c.brand : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {t.done && <Icon name="check" color="#fff" size={14} />}
                </View>
                <Text className={`flex-1 text-[15px] ${t.done ? 'text-muted line-through' : 'text-text'}`}>{t.title}</Text>
              </TouchableOpacity>
            ))
          )}
        </Section>

        {project.resources.length > 0 && (
          <View className="bg-surface border border-border rounded-xl p-4">
            <Text className="text-muted text-xs font-semibold uppercase tracking-wider mb-1">Resources</Text>
            <View className="divide-y divide-border">
              {project.resources.map((r, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => r.url && Linking.openURL(r.url)}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-3 py-2.5"
                >
                  <Icon name={RESOURCE_ICON[r.type] ?? 'link'} tone="brand" size={18} />
                  <Text className="flex-1 text-text text-[15px]" numberOfLines={1}>{r.label ?? r.title ?? r.url ?? r.type}</Text>
                  <Icon name="open-in-new" tone="muted" size={16} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <Section title="Notes" onAdd={addNote}>
          {project.notes.length === 0 ? (
            <Text className="text-muted text-sm px-1 py-2">No notes yet.</Text>
          ) : (
            project.notes.map(n => (
              <View key={n.id} className="py-2.5 gap-0.5">
                <Text className="text-text text-[15px] leading-6">{n.content}</Text>
                <Text className="text-muted text-xs">{n.date}</Text>
              </View>
            ))
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <View className="bg-surface border border-border rounded-xl p-4">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-muted text-xs font-semibold uppercase tracking-wider">{title}</Text>
        <TouchableOpacity onPress={onAdd} className="w-7 h-7 rounded-full bg-surface-2 border border-border items-center justify-center">
          <Icon name="add" tone="brand" size={18} />
        </TouchableOpacity>
      </View>
      <View className="divide-y divide-border">{children}</View>
    </View>
  );
}
