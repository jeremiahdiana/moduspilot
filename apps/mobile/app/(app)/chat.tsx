import { useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { streamChat, type Message } from '@/lib/api';
import { useDrawer } from '@/components/AppDrawer';
import { Icon } from '@/components/Icon';
import { useThemeColors } from '@/lib/theme';

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
  const c = useThemeColors();
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');

    const userMsg: UIMessage = { id: newId(), role: 'user', content: text };
    const assistantId = newId();
    const assistantMsg: UIMessage = { id: assistantId, role: 'assistant', content: '' };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    scrollToBottom();
    setStreaming(true);

    const history: Message[] = [...messages, userMsg].map(({ role, content }) => ({ role, content }));
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const chunk of streamChat(history, controller.signal)) {
        setMessages(prev => prev.map(m => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)));
        scrollToBottom();
      }
    } catch (e: unknown) {
      const name = (e as Error)?.name;
      if (name !== 'AbortError') {
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

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      {/* Minimal top bar — hamburger only */}
      <View className="px-4 py-3 flex-row items-center">
        <TouchableOpacity onPress={open} activeOpacity={0.7} className="p-1.5 -ml-1 rounded-full">
          <Icon name="menu" tone="muted" size={26} />
        </TouchableOpacity>
      </View>

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
          renderItem={({ item }) => <MessageBubble message={item} streaming={streaming} />}
          showsVerticalScrollIndicator={false}
        />

        {/* Floating glass input */}
        <View className="px-4 pb-3 pt-1">
          <View className="bg-surface-2 border border-border rounded-3xl px-2 py-2 flex-row items-end gap-2">
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
            <TouchableOpacity
              onPress={streaming ? stopStreaming : send}
              activeOpacity={0.8}
              className="bg-brand rounded-2xl items-center justify-center"
              style={{ width: 44, height: 44 }}
            >
              {streaming ? (
                <View style={{ width: 13, height: 13, backgroundColor: '#fff', borderRadius: 3 }} />
              ) : (
                <Icon name="arrow-upward" color="#fff" size={22} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ message, streaming }: { message: UIMessage; streaming: boolean }) {
  const c = useThemeColors();
  const isUser = message.role === 'user';
  const isEmpty = message.content === '' && !isUser && streaming;

  return (
    <View className={`flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <View className="w-7 h-7 rounded-full bg-brand items-center justify-center mr-2 mt-1" style={{ flexShrink: 0 }}>
          <Text className="text-white font-black text-xs">M</Text>
        </View>
      )}
      <View
        className={`rounded-2xl px-4 py-3 max-w-[80%] ${
          isUser ? 'bg-brand rounded-br-sm' : 'bg-surface border border-border rounded-bl-sm'
        }`}
      >
        {isEmpty ? (
          <ActivityIndicator size="small" color={c.muted} />
        ) : (
          <Text className={`text-base leading-6 ${isUser ? 'text-white' : 'text-text'}`}>{message.content}</Text>
        )}
      </View>
    </View>
  );
}

function Greeting() {
  return (
    <View className="flex-1 items-center justify-center gap-5 px-8" style={{ minHeight: 360 }}>
      <View className="w-24 h-24 rounded-[28px] bg-surface border border-border items-center justify-center">
        <Text className="text-brand font-black text-3xl tracking-widest">M</Text>
      </View>
      <View className="items-center gap-2">
        <Text className="text-text font-black text-3xl tracking-tight">{greeting()}</Text>
        <Text className="text-muted text-base text-center leading-relaxed">
          I'm MODUS, your AI chief of staff.{'\n'}What do you want to tackle today?
        </Text>
      </View>
    </View>
  );
}
