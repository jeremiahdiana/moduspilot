import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { doc, getDoc, addDoc, collection, serverTimestamp, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/lib/firebase';
import { streamChat, type Message, type GoalContext, type ProjectContext, type TaskContext } from '@/lib/api';
import { ModelSwitcher } from '@/components/ModelSwitcher';
import { useAuth } from '@/hooks/useAuth';
import { useDrawer } from '@/components/AppDrawer';
import { Icon, type IconName } from '@/components/Icon';
import { Markdown } from '@/components/Markdown';
import { useThemeColors } from '@/lib/theme';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ScreenFade } from '@/components/ui';
import { GlassView } from '@/components/ui/Glass';
import { Logo } from '@/components/ui/Logo';
import { GradientText } from '@/components/ui/GradientText';
import { haptics } from '@/lib/haptics';
import { ApprovalCard } from '@/components/ApprovalCard';
import { DraftOptionsCard } from '@/components/DraftOptionsCard';
import { ImageCard } from '@/components/ImageCard';
import { DocumentCard } from '@/components/DocumentCard';
import { ProactiveReveal } from '@/components/ui/ProactiveReveal';
import { ThinkingPulse } from '@/components/ui/ThinkingPulse';
import { PulseAvatar } from '@/components/ui/PulseAvatar';
import { parseApprovalParts, stripApprovalBlocks, hasApprovalBlock } from '@/lib/approval';
import { useSheets } from '@/components/ui/Sheets';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { VoiceOverlay } from '@/components/VoiceOverlay';
import {
  subscribeConversations, createConversation, saveMessages,
  loadConversation, deleteConversation, deriveTitle, ensureScopedConversation,
  type ConvSummary, type ProactiveKind,
} from '@/lib/conversations';

// Accent color per proactive card kind — mirrors the briefing palette
// (relationship nudge = blue) so the cue reads consistently across the app.
const PROACTIVE_ACCENT: Record<ProactiveKind, string> = {
  inboxTriage: '#f59e0b',
  relationshipNudge: '#3b82f6',
};

// expo-image-picker is a NATIVE module — load lazily so a JS reload before the
// native rebuild doesn't crash with "Cannot find native module 'ExpoImagePicker'".
const ImagePicker: typeof import('expo-image-picker') | null = (() => {
  try { return require('expo-image-picker'); } catch { return null; }
})();

type Scope = {
  kind: 'goal' | 'project' | 'task';
  title: string;
  goalContext?: GoalContext;
  projectContext?: ProjectContext;
  taskContext?: TaskContext;
};

type UIMessage = Message & { id: string; image?: string };

let msgCounter = 0;
function newId() { return `msg_${Date.now()}_${++msgCounter}`; }

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning.' : h < 17 ? 'Good afternoon.' : 'Good evening.';
}

const SKILL_CATEGORIES: {
  id: string; icon: IconName; label: string;
  subs: { icon: IconName; label: string; prompt: string }[];
}[] = [
  {
    id: 'write', icon: 'edit', label: 'Write or edit',
    subs: [
      { icon: 'mail-outline',  label: 'Write a cold email',   prompt: "Help me write a cold email. Ask me who I'm emailing and what I want to say." },
      { icon: 'edit-note',     label: 'Draft a message',      prompt: "Help me draft a message. Ask me who it's for and what I need to say." },
      { icon: 'help-outline',  label: 'Help me decide',       prompt: "Help me make a decision. Ask me what I'm deciding between." },
      { icon: 'compress',      label: 'Make this concise',    prompt: 'Help me make something shorter. Paste the text and I\'ll tighten it up.' },
    ],
  },
  {
    id: 'plan', icon: 'calendar-today', label: 'Plan & organize',
    subs: [
      { icon: 'calendar-today', label: 'Plan my week',         prompt: 'Help me plan my week. Ask me what I have going on and build a focused plan.' },
      { icon: 'checklist',      label: 'Daily standup',        prompt: "Run a quick daily standup with me. Ask what I did yesterday, what I'm doing today, and if anything is blocking me." },
      { icon: 'account-tree',   label: 'Break down a project', prompt: 'Help me break down a project into clear tasks. Ask me what the project is.' },
      { icon: 'flag',           label: 'Review my goals',      prompt: 'Summarize my current goals and tell me where I should be focusing most.' },
    ],
  },
  {
    id: 'create', icon: 'auto-awesome', label: 'Create',
    subs: [
      { icon: 'auto-awesome', label: 'Generate an image', prompt: "Generate an image for me. Ask me what I'd like to see, then create it." },
      { icon: 'description',  label: 'Make a PDF',        prompt: 'Help me create a PDF document. Ask me what it should contain, then produce it.' },
    ],
  },
];

function extractTaskItems(text: string): string[] {
  const tasks: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^[-•*+]\s+(.+)/) ?? line.match(/^\d+[.)]\s+(.+)/);
    if (m) {
      const t = m[1].trim().replace(/\*\*/g, '').replace(/`/g, '').replace(/^\[.\]\s*/, '');
      if (t.length > 3 && t.length < 100) tasks.push(t);
    }
  }
  return tasks.slice(0, 5);
}

export default function ChatScreen() {
  const { open } = useDrawer();
  const { user } = useAuth();
  const c = useThemeColors();
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  // Set when the open conversation was started by MODUS itself (inbox triage /
  // relationship nudge) — drives the proactive card entrance animation.
  const [proactiveKind, setProactiveKind] = useState<ProactiveKind | null>(null);
  const [conversations, setConversations] = useState<ConvSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [scope, setScope] = useState<Scope | null>(null);
  const [searchMode, setSearchMode] = useState(false);
  // Plan gates which models the switcher unlocks; modelChoice is the in-chat
  // selection ('auto' | model id), persisted across sessions via AsyncStorage.
  const [plan, setPlan] = useState<string>('free');
  const [modelChoice, setModelChoice] = useState('auto');
  const modelChoiceRef = useRef('auto');
  const convIdRef = useRef<string | null>(null);
  const scopeRef = useRef<Scope | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList>(null);

  // Scoped chat: opened from a goal/project detail screen via route params.
  const params = useLocalSearchParams<{ goalId?: string; projectId?: string; taskId?: string; prefill?: string }>();
  const scopeId = params.goalId
    ? `goal:${params.goalId}`
    : params.projectId
      ? `project:${params.projectId}`
      : params.taskId
        ? `task:${params.taskId}`
        : null;
  const handledScopeRef = useRef<string | null | undefined>(undefined);
  const prefillHandledRef = useRef(false);

  useEffect(() => { convIdRef.current = convId; }, [convId]);
  useEffect(() => { scopeRef.current = scope; }, [scope]);

  useEffect(() => {
    if (!user || handledScopeRef.current === scopeId) return;
    handledScopeRef.current = scopeId;
    if (!scopeId) { setScope(null); return; }

    let alive = true;
    (async () => {
      const kind = scopeId.split(':')[0] as 'goal' | 'project' | 'task';
      const id = scopeId.split(':')[1];
      const collectionName = kind === 'goal' ? 'goals' : kind === 'project' ? 'projects' : 'tasks';
      const convIdScoped = `${kind}-${id}`;
      const kindLabel = kind === 'goal' ? 'Goal' : kind === 'project' ? 'Project' : 'Task';
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, collectionName, id));
        const d = snap.data() ?? {};
        const title = (d.title as string) ?? kindLabel;
        const nextScope: Scope =
          kind === 'goal'
            ? { kind: 'goal', title, goalContext: { id, title, description: d.description, progress: d.progress } }
            : kind === 'project'
              ? { kind: 'project', title, projectContext: { id, title, description: d.description, status: d.status } }
              : { kind: 'task', title, taskContext: { id, title, description: d.description, done: d.done, dueDate: d.dueDate, priority: d.priority } };
        const existing = await ensureScopedConversation(user.uid, convIdScoped, {
          title: `${kindLabel}: ${title}`,
          ...(kind === 'goal' ? { goalId: id } : kind === 'project' ? { projectId: id } : { taskId: id }),
        });
        if (!alive) return;
        abortRef.current?.abort();
        setMessages(existing.map(m => ({ id: m.id || newId(), role: m.role, content: m.content })));
        setProactiveKind(null);
        setConvId(convIdScoped);
        convIdRef.current = convIdScoped;
        setScope(nextScope);
        scrollToBottom();
      } catch { /* fall back to a normal chat */ }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, scopeId]);

  useEffect(() => {
    if (!user) return;
    return subscribeConversations(user.uid, setConversations);
  }, [user]);

  // Live plan (unlocks models in the switcher) + persisted model choice.
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), snap => {
      setPlan((snap.data()?.plan as string) ?? 'free');
    });
  }, [user]);

  useEffect(() => {
    AsyncStorage.getItem('modus:modelChoice').then(v => {
      if (v) { setModelChoice(v); modelChoiceRef.current = v; }
    });
  }, []);

  const handleModelChange = useCallback((v: string) => {
    setModelChoice(v);
    modelChoiceRef.current = v;
    AsyncStorage.setItem('modus:modelChoice', v).catch(() => {});
  }, []);

  const voice = useVoiceInput(useCallback((text: string) => {
    setInput(prev => (prev.trim() ? prev.trimEnd() + ' ' : '') + text);
  }, []));

  useEffect(() => {
    if (voice.error) Alert.alert('Voice input', voice.error);
  }, [voice.error]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  // Save the current message list to Firestore, creating the conversation doc
  // on the first exchange. Uses a ref for convId so concurrent saves share one doc.
  const persist = useCallback(async (msgs: UIMessage[]) => {
    if (!user || msgs.length === 0) return;
    const stored = msgs.map(m => ({ id: m.id, role: m.role, content: m.content }));
    const title = deriveTitle(stored);
    try {
      let id = convIdRef.current;
      if (!id) {
        id = await createConversation(user.uid, title);
        convIdRef.current = id;
        setConvId(id);
      }
      await saveMessages(user.uid, id, stored, title);
    } catch {
      // non-fatal — chat still works in-memory
    }
  }, [user]);

  function startNewChat() {
    abortRef.current?.abort();
    setMessages([]);
    setConvId(null);
    convIdRef.current = null;
    setProactiveKind(null);
    setHistoryOpen(false);
    if (scopeRef.current) {
      setScope(null);
      handledScopeRef.current = null;
      router.setParams({ goalId: '', projectId: '', taskId: '' });
    }
  }

  async function openConversation(id: string) {
    if (!user) return;
    setHistoryOpen(false);
    setScope(null);
    try {
      const { messages: stored, proactive } = await loadConversation(user.uid, id);
      setMessages(stored.map(m => ({ id: m.id || newId(), role: m.role, content: m.content })));
      setProactiveKind(proactive ?? null);
      setConvId(id);
      convIdRef.current = id;
      scrollToBottom();
    } catch {
      Alert.alert('Error', 'Could not open that conversation.');
    }
  }

  function removeConversation(id: string) {
    if (!user) return;
    deleteConversation(user.uid, id).catch(() => {});
    if (convIdRef.current === id) startNewChat();
  }

  async function pickImage() {
    if (!ImagePicker) {
      Alert.alert('Update needed', 'Image attachments need the latest app build.');
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Photos access', 'Allow photo access to attach an image.'); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mediaTypes = (ImagePicker as any).MediaTypeOptions?.Images ?? 'images';
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes, base64: true, quality: 0.5 });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset?.base64) { Alert.alert('Couldn’t load image', 'Try a different photo.'); return; }
      if (asset.base64.length > 6_000_000) { Alert.alert('Image too large', 'Pick a smaller image.'); return; }
      haptics.select();
      setAttachedImage({ base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' });
    } catch {
      Alert.alert('Couldn’t attach image', 'Please try again.');
    }
  }

  function send() {
    const text = input.trim();
    if ((!text && !attachedImage) || streaming) return;
    const image = attachedImage;
    const finalText = searchMode && text ? `Search the web for: ${text}` : text;
    setInput('');
    setAttachedImage(null);
    setSearchMode(false);
    void sendMessage(finalText, image ?? undefined);
  }

  async function sendMessage(text: string, image?: { base64: string; mimeType: string }) {
    if ((!text.trim() && !image) || streaming) return;
    haptics.medium();

    const userMsg: UIMessage = {
      id: newId(),
      role: 'user',
      content: text || (image ? 'Image' : ''),
      ...(image ? { image: `data:${image.mimeType};base64,${image.base64}` } : {}),
    };
    const assistantId = newId();
    const assistantMsg: UIMessage = { id: assistantId, role: 'assistant', content: '' };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    scrollToBottom();
    setStreaming(true);

    const priorMessages = messages;
    const history: Message[] = [...messages, userMsg].map(({ role, content }) => ({ role, content }));
    const controller = new AbortController();
    abortRef.current = controller;

    let acc = '';
    try {
      for await (const chunk of streamChat(history, {
        signal: controller.signal,
        goalContext: scopeRef.current?.goalContext,
        projectContext: scopeRef.current?.projectContext,
        taskContext: scopeRef.current?.taskContext,
        image,
        modelChoice: modelChoiceRef.current,
      })) {
        acc += chunk;
        setMessages(prev => prev.map(m => (m.id === assistantId ? { ...m, content: acc } : m)));
        scrollToBottom();
      }
      // Persist the completed exchange (creates the conversation on first send).
      void persist([...priorMessages, userMsg, { id: assistantId, role: 'assistant', content: acc }]);
    } catch (e: unknown) {
      const name = (e as Error)?.name;
      if (name === 'AbortError') {
        // Keep whatever streamed so far if the user stopped it.
        if (acc.trim()) void persist([...priorMessages, userMsg, { id: assistantId, role: 'assistant', content: acc }]);
      } else {
        const msg = (e as Error)?.message ?? 'Something went wrong';
        if (msg.includes('subscription_required')) {
          Alert.alert(
            'Start your free trial',
            'MODUS is a paid product with a 3-day free trial. Choose a plan to continue.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Start trial', onPress: () => router.push('/(app)/billing') },
            ],
          );
        } else {
          Alert.alert('Error', 'Failed to get a response. Please try again.');
        }
        setMessages(prev => prev.filter(m => m.id !== assistantId));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  // Draft-reply / quick-ask entry: a screen opened chat with a prefilled prompt.
  useEffect(() => {
    if (!user || prefillHandledRef.current) return;
    const p = params.prefill;
    if (typeof p === 'string' && p.trim()) {
      prefillHandledRef.current = true;
      void sendMessage(p);
      router.setParams({ prefill: '' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, params.prefill]);

  const appendFollowUp = useCallback((text: string) => {
    setMessages(prev => {
      const next = [...prev, { id: newId(), role: 'assistant' as const, content: text }];
      void persist(next);
      return next;
    });
    scrollToBottom();
  }, [persist, scrollToBottom]);

  const handleAddTask = useCallback(async (title: string) => {
    if (!user) return;
    haptics.medium();
    try {
      await addDoc(collection(db, 'users', user.uid, 'tasks'), {
        title,
        done: false,
        createdAt: serverTimestamp(),
      });
    } catch { /* non-fatal */ }
  }, [user]);

  return (
    <ScreenFade>
      <SafeAreaView className="flex-1" edges={['top']}>
      <VoiceOverlay state={voice.state} level={voice.level} onStop={voice.toggle} onCancel={voice.cancel} />
      {/* Top bar — hamburger + new chat + history. Centered ambient mark signals
          MODUS is live/present (full pulse while it's responding). */}
      <View className="px-4 py-3 flex-row items-center justify-between">
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
        >
          <PulseAvatar size={22} active={streaming} ambient={!streaming} />
        </View>
        <TouchableOpacity onPress={open} activeOpacity={0.7} className="p-1.5 -ml-1 rounded-full">
          <Icon name="menu" tone="muted" size={26} />
        </TouchableOpacity>
        <View className="flex-row items-center gap-1">
          <TouchableOpacity onPress={startNewChat} activeOpacity={0.7} className="p-1.5 rounded-full">
            <Icon name="add-comment" tone="muted" size={22} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setHistoryOpen(true)} activeOpacity={0.7} className="p-1.5 rounded-full">
            <Icon name="history" tone="muted" size={24} />
          </TouchableOpacity>
        </View>
      </View>

      {scope && (
        <View className="mx-4 mb-1.5 flex-row items-center gap-2 px-3 py-2 rounded-xl bg-brand/10 border border-brand/25">
          <Icon name={scope.kind === 'goal' ? 'flag' : scope.kind === 'task' ? 'check-circle' : 'folder'} tone="brand" size={15} />
          <Text className="text-brand text-xs font-semibold flex-1" numberOfLines={1}>
            {scope.kind === 'goal' ? 'Goal' : scope.kind === 'task' ? 'Task' : 'Project'}: {scope.title}
          </Text>
          <TouchableOpacity onPress={startNewChat} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
            <Icon name="close" tone="muted" size={16} />
          </TouchableOpacity>
        </View>
      )}

      <HistoryModal
        visible={historyOpen}
        conversations={conversations}
        currentId={convId}
        onClose={() => setHistoryOpen(false)}
        onSelect={openConversation}
        onDelete={removeConversation}
        onNew={startNewChat}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          onContentSizeChange={scrollToBottom}
          ListEmptyComponent={<Greeting onSend={sendMessage} onSearchMode={() => setSearchMode(true)} />}
          renderItem={({ item, index }) => (
            <MessageBubble
              message={item}
              isStreaming={streaming && index === messages.length - 1}
              onFollowUp={appendFollowUp}
              onSend={sendMessage}
              onAddTask={handleAddTask}
              proactive={proactiveKind}
            />
          )}
          showsVerticalScrollIndicator={false}
        />

        {/* Floating glass input */}
        <View className="px-4 pb-7 pt-1">
          {searchMode && (
            <View className="flex-row mb-2">
              <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-brand/40">
                <Icon name="search" tone="brand" size={14} />
                <Text className="text-brand text-sm font-medium">Search</Text>
                <TouchableOpacity onPress={() => setSearchMode(false)} hitSlop={8} activeOpacity={0.7}>
                  <Icon name="close" tone="muted" size={14} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          <GlassView radius={28} intensity={50}>
          {attachedImage && (
            <View className="px-3 pt-3 flex-row">
              <View>
                <Image
                  source={{ uri: `data:${attachedImage.mimeType};base64,${attachedImage.base64}` }}
                  style={{ width: 56, height: 56, borderRadius: 12 }}
                />
                <TouchableOpacity
                  onPress={() => setAttachedImage(null)}
                  activeOpacity={0.8}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface border border-border items-center justify-center"
                >
                  <Icon name="close" size={13} color={c.muted} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          <View className="px-3 pt-2.5 flex-row items-center">
            <ModelSwitcher value={modelChoice} onChange={handleModelChange} plan={plan} />
          </View>
          <View className="px-2 py-2 flex-row items-end gap-2">
            <TextInput
              className="flex-1 text-text text-base px-3 py-2.5"
              style={{ maxHeight: 120 }}
              placeholder={searchMode ? 'Search the web…' : scope ? `Ask about this ${scope.kind}…` : 'Ask MODUS anything…'}
              placeholderTextColor={c.muted}
              value={input}
              onChangeText={setInput}
              multiline
              returnKeyType="send"
              onSubmitEditing={send}
              editable={!streaming}
            />
            {!streaming && (
              <TouchableOpacity
                onPress={pickImage}
                activeOpacity={0.8}
                className="rounded-xl items-center justify-center border bg-surface border-border"
                style={{ width: 36, height: 36 }}
              >
                <Icon name="image" size={17} color={c.muted} />
              </TouchableOpacity>
            )}
            {!streaming && (
              <TouchableOpacity
                onPress={voice.toggle}
                activeOpacity={0.8}
                className="rounded-xl items-center justify-center border bg-surface border-border"
                style={{ width: 36, height: 36 }}
              >
                <Icon name="mic-none" size={17} color={c.muted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={streaming ? stopStreaming : send}
              activeOpacity={0.8}
              className="bg-brand items-center justify-center"
              style={{ width: 36, height: 36, borderRadius: 12 }}
            >
              {streaming ? (
                <View style={{ width: 11, height: 11, backgroundColor: '#fff', borderRadius: 3 }} />
              ) : (
                <Icon name="arrow-upward" color="#fff" size={18} />
              )}
            </TouchableOpacity>
          </View>
          </GlassView>
        </View>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenFade>
  );
}

function MessageBubble({
  message,
  isStreaming,
  onFollowUp,
  onSend,
  onAddTask,
  proactive,
}: {
  message: UIMessage;
  isStreaming: boolean;
  onFollowUp: (text: string) => void;
  onSend: (text: string) => void;
  onAddTask: (title: string) => void;
  proactive?: ProactiveKind | null;
}) {
  const [savedTasks, setSavedTasks] = useState<Set<string>>(new Set());
  const c = useThemeColors();
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <Animated.View entering={FadeInUp.duration(200)} className="flex-row justify-end">
        <View
          className="bg-brand overflow-hidden"
          style={{ borderRadius: 18, borderBottomRightRadius: 4, maxWidth: '80%' }}
        >
          {message.image && (
            <Image source={{ uri: message.image }} style={{ width: 200, height: 200 }} resizeMode="cover" />
          )}
          {message.content ? (
            <View className="px-4 py-3">
              <Text className="text-base leading-6 text-white">{message.content}</Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
    );
  }

  const isEmpty = message.content === '' && isStreaming;
  const hasAction = hasApprovalBlock(message.content);
  const actionLabel = message.content.includes('```image') ? 'Creating image…'
    : message.content.includes('```document') ? 'Writing document…'
    : 'Preparing action…';

  // While streaming, hide the (possibly incomplete) approval JSON and show a
  // pulse. Once finished, split into text + interactive approval cards.
  const displayText = isStreaming ? stripApprovalBlocks(message.content) : null;
  const parts = isStreaming ? null : parseApprovalParts(message.content);

  return (
    <Animated.View entering={FadeInUp.duration(220)} className="flex-row justify-start">
      <View
        style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 4, flexShrink: 0 }}
      >
        <PulseAvatar size={26} active={isStreaming} />
      </View>
      <View className="max-w-[82%] gap-2" style={{ flex: 1 }}>
        {isEmpty ? (
          <View className="rounded-2xl rounded-bl-sm px-4 py-4 bg-surface border border-border self-start">
            <ThinkingPulse />
          </View>
        ) : isStreaming ? (
          <>
            {displayText ? (
              <View className="rounded-2xl rounded-bl-sm px-4 py-3 bg-surface border border-border self-start">
                <Markdown text={displayText} />
              </View>
            ) : null}
            {hasAction && (
              <View className="flex-row items-center gap-2 px-4 py-3 border border-border bg-surface rounded-2xl self-start">
                <View className="w-1.5 h-1.5 rounded-full bg-brand" />
                <Text className="text-muted text-xs">{actionLabel}</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {parts!.map((part, i) =>
              part.type === 'approval' ? (
                proactive ? (
                  <ProactiveReveal key={i} accent={PROACTIVE_ACCENT[proactive]} radius={16}>
                    <ApprovalCard raw={part.value} onFollowUp={onFollowUp} />
                  </ProactiveReveal>
                ) : (
                  <ApprovalCard key={i} raw={part.value} onFollowUp={onFollowUp} />
                )
              ) : part.type === 'draft_options' ? (
                <DraftOptionsCard key={i} raw={part.value} onSend={onSend} />
              ) : part.type === 'image' ? (
                <ImageCard key={i} raw={part.value} />
              ) : part.type === 'document' ? (
                <DocumentCard key={i} raw={part.value} />
              ) : part.value.trim() ? (
                <View key={i} className="rounded-2xl rounded-bl-sm px-4 py-3 bg-surface border border-border self-start">
                  <Markdown text={part.value.trim()} />
                </View>
              ) : null,
            )}
            {/* Task capture chips — shown when message has bullet/numbered items */}
            {(() => {
              const items = extractTaskItems(message.content);
              if (items.length === 0) return null;
              return (
                <View className="gap-1.5 self-start">
                  <Text className="text-muted text-[10px] font-semibold uppercase tracking-wider px-1">Save as task</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {items.map(item => {
                      const saved = savedTasks.has(item);
                      return (
                        <TouchableOpacity
                          key={item}
                          onPress={() => {
                            if (saved) return;
                            onAddTask(item);
                            setSavedTasks(prev => new Set([...prev, item]));
                          }}
                          activeOpacity={0.7}
                          className={`flex-row items-center gap-1 px-2.5 py-1.5 rounded-full border ${saved ? 'border-brand/30 bg-brand/10' : 'border-border bg-surface'}`}
                        >
                          <Icon name={saved ? 'check' : 'add'} size={13} color={saved ? '#6366f1' : '#888'} />
                          <Text className={`text-xs ${saved ? 'text-brand' : 'text-muted'}`} numberOfLines={1} style={{ maxWidth: 180 }}>{item}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })()}
          </>
        )}
      </View>
    </Animated.View>
  );
}

function Greeting({ onSend, onSearchMode }: { onSend: (text: string) => void; onSearchMode: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const expandedCat = SKILL_CATEGORIES.find(c => c.id === expanded) ?? null;

  return (
    <View style={{ flex: 1, minHeight: 440 }}>
      {/* Center: logo + greeting — each element staggers in */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <Logo width={80} />
        <View style={{ alignItems: 'center', gap: 6 }}>
          <GradientText className="font-black text-4xl tracking-tight" style={{ paddingVertical: 2 }}>
            {greeting()}
          </GradientText>
          <Text className="text-muted text-base text-center leading-relaxed">
            {'I\'m MODUS, your AI chief of staff.\nWhat do you want to tackle today?'}
          </Text>
        </View>
      </View>

      {expanded && expandedCat ? (
        <View key={`expanded-${expanded}`}>
          <View className="flex-row items-center justify-between px-5 pb-2">
            <Text className="text-text font-semibold text-base">{expandedCat.label}</Text>
            <TouchableOpacity onPress={() => setExpanded(null)} hitSlop={10} activeOpacity={0.6}>
              <Icon name="close" tone="muted" size={22} />
            </TouchableOpacity>
          </View>
          {expandedCat.subs.map((sub, i) => (
            <TouchableOpacity
              key={sub.label}
              onPress={() => { setExpanded(null); onSend(sub.prompt); }}
              activeOpacity={0.5}
              className="flex-row items-center gap-4 px-5 py-3.5"
            >
              <Icon name={sub.icon} tone="muted" size={20} />
              <Text className="text-text text-[16px]">{sub.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View key="root-skills">
          {SKILL_CATEGORIES.map((cat, i) => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setExpanded(cat.id)}
              activeOpacity={0.5}
              className="flex-row items-center gap-4 px-5 py-4"
            >
              <Icon name={cat.icon} tone="muted" size={22} />
              <Text className="text-text text-[17px]">{cat.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={onSearchMode}
            activeOpacity={0.5}
            className="flex-row items-center gap-4 px-5 py-4"
          >
            <Icon name="search" tone="muted" size={22} />
            <Text className="text-text text-[17px]">Look something up</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function HistoryModal({
  visible, conversations, currentId, onClose, onSelect, onDelete, onNew,
}: {
  visible: boolean;
  conversations: ConvSummary[];
  currentId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const { confirm } = useSheets();
  async function confirmDelete(conv: ConvSummary) {
    const ok = await confirm({ title: conv.title, message: 'Delete this conversation?', confirmLabel: 'Delete', destructive: true });
    if (ok) onDelete(conv.id);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40">
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onClose} />
        <View className="bg-bg rounded-t-3xl border-t border-border" style={{ maxHeight: '78%' }}>
          <View className="px-5 pt-4 pb-3 flex-row items-center justify-between border-b border-border">
            <Text className="text-text font-bold text-lg">Chats</Text>
            <TouchableOpacity onPress={onNew} className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand">
              <Icon name="add" color="#fff" size={18} />
              <Text className="text-white font-semibold text-sm">New</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={conversations}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 12, gap: 6 }}
            ListEmptyComponent={
              <View className="items-center py-16 px-8 gap-2">
                <Icon name="forum" tone="muted" size={40} />
                <Text className="text-muted text-sm text-center">No saved chats yet.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const active = item.id === currentId;
              return (
                <TouchableOpacity
                  onPress={() => onSelect(item.id)}
                  onLongPress={() => confirmDelete(item)}
                  activeOpacity={0.7}
                  className={`flex-row items-center gap-3 px-4 py-3 rounded-2xl border ${active ? 'bg-brand/10 border-brand/30' : 'bg-surface border-border'}`}
                >
                  <Icon name="chat-bubble-outline" tone={active ? 'brand' : 'muted'} size={18} />
                  <Text className={`flex-1 text-sm ${active ? 'text-brand font-semibold' : 'text-text'}`} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text className="text-muted text-xs">{relativeTime(item.updatedAt)}</Text>
                  <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={8} className="pl-1">
                    <Icon name="close" tone="muted" size={16} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
