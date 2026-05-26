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

type UIMessage = Message & { id: string };

let msgCounter = 0;
function newId() {
  return `msg_${Date.now()}_${++msgCounter}`;
}

export default function ChatScreen() {
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
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m,
          ),
        );
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
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      {/* Header */}
      <View className="px-5 py-3 border-b border-border flex-row items-center">
        <Text className="text-xl font-black text-brand tracking-widest flex-1">MODUS</Text>
        <View className="flex-row items-center gap-1.5">
          <View className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <Text className="text-xs text-muted">Live</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          onContentSizeChange={scrollToBottom}
          ListEmptyComponent={<EmptyState />}
          renderItem={({ item }) => <MessageBubble message={item} streaming={streaming} />}
        />

        {/* Input bar */}
        <View className="px-4 pb-2 pt-3 border-t border-border flex-row items-end gap-3">
          <TextInput
            className="flex-1 bg-surface rounded-2xl px-4 py-3 text-text text-base"
            style={{ minHeight: 48, maxHeight: 120 }}
            placeholder="Ask MODUS anything..."
            placeholderTextColor="#6b6b80"
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
            style={{ width: 48, height: 48 }}
          >
            {streaming ? (
              <View className="w-3.5 h-3.5 bg-white rounded-sm" />
            ) : (
              <Text className="text-white font-bold text-lg">↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ message, streaming }: { message: UIMessage; streaming: boolean }) {
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
          isUser
            ? 'bg-brand rounded-br-sm'
            : 'bg-surface-2 rounded-bl-sm'
        }`}
      >
        {isEmpty ? (
          <ActivityIndicator size="small" color="#6b6b80" />
        ) : (
          <Text className={`text-base leading-6 ${isUser ? 'text-white' : 'text-text'}`}>
            {message.content}
          </Text>
        )}
      </View>
    </View>
  );
}

function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center py-20 gap-3">
      <View className="w-16 h-16 rounded-full bg-surface border border-border items-center justify-center">
        <Text className="text-brand font-black text-xl tracking-widest">M</Text>
      </View>
      <Text className="text-text font-semibold text-lg">Good morning.</Text>
      <Text className="text-muted text-sm text-center px-8">
        I'm MODUS, your AI chief of staff.{'\n'}What do you want to tackle today?
      </Text>
    </View>
  );
}
