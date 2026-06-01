import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { streamChat, type Message } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useDrawer } from '@/components/AppDrawer';
import { Icon } from '@/components/Icon';
import { Markdown } from '@/components/Markdown';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENTS, useThemeColors } from '@/lib/theme';
import { GlassView } from '@/components/ui/Glass';
import { GradientText } from '@/components/ui/GradientText';
import { haptics } from '@/lib/haptics';
import { ApprovalCard } from '@/components/ApprovalCard';
import { parseApprovalParts, stripApprovalBlocks, hasApprovalBlock } from '@/lib/approval';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import {
  subscribeConversations, createConversation, saveMessages,
  loadConversation, deleteConversation, deriveTitle,
  type ConvSummary,
} from '@/lib/conversations';

type UIMessage = Message & { id: string };

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
  const [streaming, setStreaming] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConvSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const convIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => { convIdRef.current = convId; }, [convId]);

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
    setHistoryOpen(false);
  }

  async function openConversation(id: string) {
    if (!user) return;
    setHistoryOpen(false);
    try {
      const stored = await loadConversation(user.uid, id);
      setMessages(stored.map(m => ({ id: m.id || newId(), role: m.role, content: m.content })));
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

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    haptics.medium();
    setInput('');

    const userMsg: UIMessage = { id: newId(), role: 'user', content: text };
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
      for await (const chunk of streamChat(history, controller.signal)) {
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
      {/* Top bar — hamburger + new chat + history */}
      <View className="px-4 py-3 flex-row items-center justify-between">
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
            />
          )}
          showsVerticalScrollIndicator={false}
        />

        {/* Floating glass input */}
        <View className="px-4 pb-3 pt-1">
          <GlassView radius={28} intensity={50}>
          <View className="px-2 py-2 flex-row items-end gap-2">
            <TextInput
              className="flex-1 text-text text-base px-3 py-2.5"
              style={{ maxHeight: 120 }}
              placeholder="Ask MODUS anything…"
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
                onPress={voice.toggle}
                activeOpacity={0.8}
                className={`rounded-2xl items-center justify-center border ${voice.state === 'recording' ? 'bg-red-500/10 border-red-500/40' : 'bg-surface border-border'}`}
                style={{ width: 44, height: 44 }}
              >
                {voice.state === 'transcribing' ? (
                  <ActivityIndicator size="small" color={c.muted} />
                ) : (
                  <Icon
                    name={voice.state === 'recording' ? 'stop' : 'mic-none'}
                    size={22}
                    color={voice.state === 'recording' ? '#ef4444' : c.muted}
                  />
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={streaming ? stopStreaming : send} activeOpacity={0.8}>
              <LinearGradient
                colors={GRADIENTS.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
              >
                {streaming ? (
                  <View style={{ width: 13, height: 13, backgroundColor: '#fff', borderRadius: 3 }} />
                ) : (
                  <Icon name="arrow-upward" color="#fff" size={22} />
                )}
              </LinearGradient>
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
}: {
  message: UIMessage;
  isStreaming: boolean;
  onFollowUp: (text: string) => void;
}) {
  const c = useThemeColors();
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <View className="flex-row justify-end">
        <LinearGradient
          colors={GRADIENTS.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 18, borderBottomRightRadius: 4, maxWidth: '80%' }}
        >
          <View className="px-4 py-3">
            <Text className="text-base leading-6 text-white">{message.content}</Text>
          </View>
        </LinearGradient>
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
      <LinearGradient
        colors={GRADIENTS.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 4, flexShrink: 0 }}
      >
        <Text className="text-white font-display font-bold text-xs">M</Text>
      </LinearGradient>
      <View className="max-w-[82%] gap-2" style={{ flex: 1 }}>
        {isEmpty ? (
          <View className="rounded-2xl rounded-bl-sm px-4 py-3 bg-surface border border-border self-start">
            <ActivityIndicator size="small" color={c.muted} />
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
              <ApprovalCard key={i} raw={part.value} onFollowUp={onFollowUp} />
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
      <LinearGradient
        colors={GRADIENTS.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: 92, height: 92, borderRadius: 30, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text className="text-white font-display font-bold text-4xl tracking-widest">M</Text>
      </LinearGradient>
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
  function confirmDelete(conv: ConvSummary) {
    Alert.alert(conv.title, 'Delete this conversation?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(conv.id) },
    ]);
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
