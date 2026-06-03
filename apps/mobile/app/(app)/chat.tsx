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
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { streamChat, type Message, type GoalContext, type ProjectContext, type TaskContext } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useDrawer } from '@/components/AppDrawer';
import { Icon } from '@/components/Icon';
import { Markdown } from '@/components/Markdown';
import { useThemeColors } from '@/lib/theme';
import { GlassView } from '@/components/ui/Glass';
import { Logo } from '@/components/ui/Logo';
import { GradientText } from '@/components/ui/GradientText';
import { haptics } from '@/lib/haptics';
import { ApprovalCard } from '@/components/ApprovalCard';
import { DraftOptionsCard } from '@/components/DraftOptionsCard';
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
function newId() {
  return `msg_${Date.now()}_${++msgCounter}`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning.' : h < 17 ? 'Good afternoon.' : 'Good evening.';
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
    setInput('');
    setAttachedImage(null);
    void sendMessage(text, image ?? undefined);
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
        if (msg.includes('daily_limit_reached')) {
          Alert.alert('Daily limit reached', 'Upgrade to MODUS for unlimited messages.');
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

  return (
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
          ListEmptyComponent={<Greeting />}
          renderItem={({ item, index }) => (
            <MessageBubble
              message={item}
              isStreaming={streaming && index === messages.length - 1}
              onFollowUp={appendFollowUp}
              onSend={sendMessage}
              proactive={proactiveKind}
            />
          )}
          showsVerticalScrollIndicator={false}
        />

        {/* Floating glass input */}
        <View className="px-4 pb-3 pt-1">
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
          <View className="px-2 py-2 flex-row items-end gap-2">
            <TextInput
              className="flex-1 text-text text-base px-3 py-2.5"
              style={{ maxHeight: 120 }}
              placeholder={scope ? `Ask about this ${scope.kind}…` : 'Ask MODUS anything…'}
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
                className="rounded-2xl items-center justify-center border bg-surface border-border"
                style={{ width: 44, height: 44 }}
              >
                <Icon name="image" size={22} color={c.muted} />
              </TouchableOpacity>
            )}
            {!streaming && (
              <TouchableOpacity
                onPress={voice.toggle}
                activeOpacity={0.8}
                className="rounded-2xl items-center justify-center border bg-surface border-border"
                style={{ width: 44, height: 44 }}
              >
                <Icon name="mic-none" size={22} color={c.muted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={streaming ? stopStreaming : send}
              activeOpacity={0.8}
              className="bg-brand items-center justify-center"
              style={{ width: 44, height: 44, borderRadius: 16 }}
            >
              {streaming ? (
                <View style={{ width: 13, height: 13, backgroundColor: '#fff', borderRadius: 3 }} />
              ) : (
                <Icon name="arrow-upward" color="#fff" size={22} />
              )}
            </TouchableOpacity>
          </View>
          </GlassView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({
  message,
  isStreaming,
  onFollowUp,
  onSend,
  proactive,
}: {
  message: UIMessage;
  isStreaming: boolean;
  onFollowUp: (text: string) => void;
  onSend: (text: string) => void;
  proactive?: ProactiveKind | null;
}) {
  const c = useThemeColors();
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <View className="flex-row justify-end">
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
      </View>
    );
  }

  const isEmpty = message.content === '' && isStreaming;
  const hasAction = hasApprovalBlock(message.content);

  // While streaming, hide the (possibly incomplete) approval JSON and show a
  // pulse. Once finished, split into text + interactive approval cards.
  const displayText = isStreaming ? stripApprovalBlocks(message.content) : null;
  const parts = isStreaming ? null : parseApprovalParts(message.content);

  return (
    <View className="flex-row justify-start">
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
                <Text className="text-muted text-xs">Preparing action…</Text>
              </View>
            )}
          </>
        ) : (
          parts!.map((part, i) =>
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
            ) : part.value.trim() ? (
              <View key={i} className="rounded-2xl rounded-bl-sm px-4 py-3 bg-surface border border-border self-start">
                <Markdown text={part.value.trim()} />
              </View>
            ) : null,
          )
        )}
      </View>
    </View>
  );
}

function Greeting() {
  return (
    <View className="flex-1 items-center justify-center gap-5 px-8" style={{ minHeight: 360 }}>
      <Logo width={92} />
      <View className="items-center gap-2">
        <GradientText className="font-black text-4xl tracking-tight" style={{ paddingVertical: 2 }}>
          {greeting()}
        </GradientText>
        <Text className="text-muted text-base text-center leading-relaxed">
          I'm MODUS, your AI chief of staff.{'\n'}What do you want to tackle today?
        </Text>
      </View>
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
