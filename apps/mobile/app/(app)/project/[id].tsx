import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Linking,
  TextInput, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  doc, onSnapshot, updateDoc, deleteDoc, arrayUnion,
  collection, query, where, addDoc, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { DetailHeader } from '@/components/DetailHeader';
import { Icon, type IconName } from '@/components/Icon';
import { useSheets } from '@/components/ui/Sheets';
import { useThemeColors } from '@/lib/theme';
import { Markdown } from '@/components/Markdown';
import { GlassView } from '@/components/ui/Glass';
import { streamChat, type Message, type ProjectContext } from '@/lib/api';
import { loadConversation, saveMessages, deriveTitle, type StoredMessage } from '@/lib/conversations';
import { haptics } from '@/lib/haptics';

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
interface ProjectConv { id: string; title: string; updatedAt: Date; }
type ChatMsg = { id: string; role: 'user' | 'assistant'; content: string };
type Tab = 'overview' | 'modus';

const RESOURCE_ICON: Record<string, IconName> = {
  github: 'code', notion: 'description', slack: 'tag', drive: 'folder', url: 'link',
};
const QUICK_CHIPS = ["What's blocking?", 'Next steps', 'Daily standup'];

let msgCount = 0;
function newId() { return `pm_${Date.now()}_${++msgCount}`; }

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const c = useThemeColors();
  const { actionSheet, prompt, confirm } = useSheets();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Multi-conversation state
  const [convs, setConvs] = useState<ProjectConv[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList>(null);
  const mountedRef = useRef(true);
  const savingRef = useRef(false);

  useEffect(() => () => {
    mountedRef.current = false;
    abortRef.current?.abort();
  }, []);

  // Load project
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

  // Load tasks
  useEffect(() => {
    if (!user || !id) return;
    const q = query(collection(db, 'users', user.uid, 'tasks'), where('projectId', '==', id));
    return onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, title: d.data().title ?? 'Untitled', done: d.data().done ?? false })));
    });
  }, [user, id]);

  // Subscribe to all conversations scoped to this project
  useEffect(() => {
    if (!user || !id) return;
    const q = query(
      collection(db, 'users', user.uid, 'conversations'),
      where('projectId', '==', id),
      orderBy('updatedAt', 'desc'),
    );
    return onSnapshot(q, snap => {
      const list: ProjectConv[] = snap.docs
        .filter(d => !d.data().deleted)
        .map(d => ({
          id: d.id,
          title: d.data().title ?? 'Chat',
          updatedAt: d.data().updatedAt?.toDate?.() ?? new Date(),
        }));
      setConvs(list);

      // Auto-select the first (most recent) conv if none selected
      if (list.length > 0 && !activeConvId) {
        openConv(list[0].id);
      }
    });
  }, [user, id]);

  const ref = () => doc(db, 'users', user!.uid, 'projects', id!);

  async function openConv(convId: string) {
    if (!user || convId === activeConvId) return;
    setActiveConvId(convId);
    try {
      const { messages: stored } = await loadConversation(user.uid, convId);
      if (!mountedRef.current) return;
      if (stored.length === 0 && project) {
        setChatMsgs([{ id: '0', role: 'assistant', content: `"${project.title}" is ready. Ask me to help plan, break down tasks, or explore next steps.` }]);
      } else {
        setChatMsgs(stored.map(m => ({ id: m.id || newId(), role: m.role as ChatMsg['role'], content: m.content })));
      }
    } catch {
      setChatMsgs([]);
    }
  }

  async function newChat() {
    if (!user || !project || !id) return;
    haptics.medium();
    const ref = await addDoc(collection(db, 'users', user.uid, 'conversations'), {
      title: 'New chat',
      projectId: id,
      messages: [],
      deleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setActiveConvId(ref.id);
    setChatMsgs([{ id: '0', role: 'assistant', content: `"${project.title}" is ready. What would you like to work on?` }]);
    setChatInput('');
  }

  // Persist messages to Firestore after stream completes
  async function persist(msgs: ChatMsg[], convId: string) {
    if (!user || savingRef.current) return;
    savingRef.current = true;
    try {
      const stored: StoredMessage[] = msgs
        .filter(m => m.id !== '0') // skip greeting
        .map(m => ({ id: m.id, role: m.role, content: m.content }));
      const title = deriveTitle(stored);
      await saveMessages(user.uid, convId, stored, title || undefined);
    } catch { /* non-fatal */ } finally {
      savingRef.current = false;
    }
  }

  async function sendChat(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming || !project || !user) return;
    haptics.select();
    setChatInput('');

    // Ensure we have a conversation to write to
    let convId = activeConvId;
    if (!convId) {
      const ref = await addDoc(collection(db, 'users', user.uid, 'conversations'), {
        title: 'New chat',
        projectId: id,
        messages: [],
        deleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      convId = ref.id;
      setActiveConvId(convId);
    }

    const userMsg: ChatMsg = { id: newId(), role: 'user', content: trimmed };
    const asstMsg: ChatMsg = { id: newId(), role: 'assistant', content: '' };
    let currentMsgs: ChatMsg[] = [];
    setChatMsgs(prev => {
      currentMsgs = [...prev, userMsg, asstMsg];
      return currentMsgs;
    });
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreaming(true);

    const apiMsgs: Message[] = [
      ...chatMsgs.filter(m => m.id !== '0').map(m => ({ role: m.role as Message['role'], content: m.content })),
      { role: 'user', content: trimmed },
    ];
    const ctx: ProjectContext = { id: id!, title: project.title, description: project.description };

    try {
      for await (const chunk of streamChat(apiMsgs, { signal: ctrl.signal, projectContext: ctx })) {
        if (!mountedRef.current) break;
        setChatMsgs(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: last.content + chunk };
          currentMsgs = next;
          return next;
        });
        listRef.current?.scrollToEnd({ animated: false });
      }
    } catch { /* abort */ } finally {
      if (mountedRef.current) {
        setStreaming(false);
        abortRef.current = null;
        persist(currentMsgs, convId);
      }
    }
  }

  // ── Overview helpers ──────────────────────────────────────────────────────────

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
  const noChats = convs.length === 0 && !activeConvId;

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <DetailHeader
        right={
          <TouchableOpacity onPress={menu} className="w-10 h-10 items-center justify-center rounded-2xl bg-surface border border-border">
            <Icon name="more-horiz" tone="text" size={22} />
          </TouchableOpacity>
        }
      />

      {/* Tab bar */}
      <View className="flex-row border-b border-border">
        {(['overview', 'modus'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
            className={`flex-1 py-3 items-center border-b-2 ${activeTab === tab ? 'border-brand' : 'border-transparent'}`}
          >
            <View className="flex-row items-center gap-1.5">
              {tab === 'modus' && <Icon name="auto-awesome" size={13} color={activeTab === 'modus' ? c.brand : c.muted} />}
              <Text className={`text-sm font-semibold ${activeTab === tab ? 'text-brand' : 'text-muted'}`}>
                {tab === 'overview' ? 'Overview' : 'MODUS'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'overview' ? (
        // ── Overview tab ──────────────────────────────────────────────────────────
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
                  <TouchableOpacity key={i} onPress={() => r.url && Linking.openURL(r.url)} activeOpacity={0.7} className="flex-row items-center gap-3 py-2.5">
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
      ) : (
        // ── MODUS tab ─────────────────────────────────────────────────────────────
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Conversation list header */}
          <View className="border-b border-border">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: 'row', alignItems: 'center' }}
            >
              {convs.map(conv => (
                <TouchableOpacity
                  key={conv.id}
                  onPress={() => openConv(conv.id)}
                  activeOpacity={0.7}
                  className={`px-3.5 py-1.5 rounded-full border ${activeConvId === conv.id ? 'bg-brand/10 border-brand/40' : 'bg-surface border-border'}`}
                >
                  <Text className={`text-xs font-medium ${activeConvId === conv.id ? 'text-brand' : 'text-text'}`} numberOfLines={1}>
                    {conv.title}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={newChat}
                activeOpacity={0.7}
                className="w-7 h-7 rounded-full border border-border bg-surface items-center justify-center"
              >
                <Icon name="add" tone="brand" size={18} />
              </TouchableOpacity>
            </ScrollView>
          </View>

          {noChats ? (
            // Empty state — no conversations yet
            <View className="flex-1 items-center justify-center gap-4 px-8">
              <View className="w-12 h-12 rounded-2xl bg-brand/10 items-center justify-center">
                <Icon name="auto-awesome" tone="brand" size={24} />
              </View>
              <Text className="text-text font-semibold text-center">Ask MODUS about this project</Text>
              <Text className="text-muted text-sm text-center">Plan tasks, explore next steps, or get unstuck.</Text>
              <View className="flex-row flex-wrap justify-center gap-2">
                {QUICK_CHIPS.map(chip => (
                  <TouchableOpacity key={chip} onPress={() => sendChat(chip)} activeOpacity={0.8} className="px-3 py-1.5 rounded-full border border-brand/30 bg-brand/5">
                    <Text className="text-brand text-xs font-medium">{chip}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <>
              <FlatList
                ref={listRef}
                data={chatMsgs}
                keyExtractor={m => m.id}
                contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 8 }}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View className={`flex-row ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <View
                      className={`rounded-2xl px-4 py-3 ${item.role === 'user' ? 'bg-brand rounded-tr-sm' : 'bg-surface border border-border rounded-tl-sm'}`}
                      style={{ maxWidth: '85%' }}
                    >
                      {item.role === 'user' ? (
                        <Text className="text-white text-[15px] leading-6">{item.content}</Text>
                      ) : (
                        <Markdown text={item.content || '…'} />
                      )}
                    </View>
                  </View>
                )}
              />

              {/* Quick chips — only when this is a fresh conversation */}
              {chatMsgs.filter(m => m.role === 'user').length === 0 && (
                <View className="flex-row flex-wrap gap-2 px-4 pb-2">
                  {QUICK_CHIPS.map(chip => (
                    <TouchableOpacity key={chip} onPress={() => sendChat(chip)} activeOpacity={0.8} className="px-3 py-1.5 rounded-full border border-brand/30 bg-brand/5">
                      <Text className="text-brand text-xs font-medium">{chip}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Input bar */}
          <View className="px-4 pb-7 pt-1">
            <GlassView radius={24} intensity={50}>
              <View className="px-3 py-2 flex-row items-end gap-2">
                <TextInput
                  className="flex-1 text-text text-base px-2 py-2"
                  style={{ maxHeight: 100 }}
                  placeholder="Ask MODUS about this project…"
                  placeholderTextColor={c.muted}
                  value={chatInput}
                  onChangeText={setChatInput}
                  multiline
                  editable={!streaming}
                  onSubmitEditing={() => sendChat(chatInput)}
                />
                <TouchableOpacity
                  onPress={() => sendChat(chatInput)}
                  activeOpacity={0.8}
                  disabled={!chatInput.trim() || streaming}
                  className="bg-brand items-center justify-center"
                  style={{ width: 36, height: 36, borderRadius: 12, opacity: (!chatInput.trim() || streaming) ? 0.45 : 1 }}
                >
                  <Icon name="arrow-upward" color="#fff" size={18} />
                </TouchableOpacity>
              </View>
            </GlassView>
          </View>
        </KeyboardAvoidingView>
      )}
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
