import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon } from '@/components/Icon';

interface Tip {
  title: string;
  body: string;
  tag?: string;
}

interface Section {
  heading: string;
  icon: string;
  tips: Tip[];
}

// Kept in sync with apps/web/components/settings/TipsSettings.tsx. The mobile app
// is not in the turbo workspace, so the content is intentionally duplicated.
const SECTIONS: Section[] = [
  {
    heading: 'Using MODUS AI',
    icon: '🤖',
    tips: [
      {
        title: 'Approval cards — approve, edit, or skip',
        body: 'When MODUS proposes an action (create goal, schedule event, send email), it surfaces an approval card. Approve it as-is, tap Edit to change it, or Skip to ignore it. Nothing executes until you say so.',
        tag: 'Core mechanic',
      },
      {
        title: 'Ask MODUS to create things from chat',
        body: 'Say "add that as a goal", "create a task for X", "add a daily habit for Y", or "schedule that for Thursday at 3pm" — MODUS surfaces the right card immediately.',
      },
      {
        title: 'Email reply drafting',
        body: 'Paste an email and say "draft a reply". MODUS asks you to pick a tone (Optimistic, Candid, Strategic) before writing — so the reply sounds like you. Then you approve the send.',
        tag: 'Workflow',
      },
      {
        title: 'Schedule straight from an email',
        body: 'Paste or forward an email and say "put this on my calendar". MODUS pulls out the date and time and surfaces a calendar hold — approve it and the event lands in Google Calendar.',
        tag: 'Cross-tool',
      },
      {
        title: 'Tell MODUS who you are',
        body: 'Settings → Personal context. Write 2–5 sentences about your role, how you like to work, and your priorities. MODUS reads this in every conversation.',
        tag: 'Setup tip',
      },
    ],
  },
  {
    heading: 'Proactive — MODUS works on its own',
    icon: '✨',
    tips: [
      {
        title: 'MODUS triages your inbox for you',
        body: 'Through the day MODUS scans your connected inbox for emails waiting on a reply, drafts a response in your voice, and sends it to you with a push notification. Approve, edit, or skip — nothing sends until you tap. Turn it off in the web app under Capabilities → Inbox Triage.',
        tag: 'Automatic',
      },
      {
        title: 'Meeting requests become calendar holds',
        body: 'When an email proposes a specific date and time, MODUS recognizes the meeting request and surfaces a calendar hold instead of a reply. Approve it and the event is created in your Google Calendar — no copying details by hand.',
        tag: 'Cross-tool',
      },
      {
        title: 'Pre- and post-meeting briefs',
        body: 'Before a meeting MODUS sends a sharp brief: what it is likely about, what to have in mind, and one question to be ready for. After it ends, it asks how it went and can turn action items into tasks.',
      },
      {
        title: 'Your morning briefing reads your whole day',
        body: 'At the time you set, MODUS builds a briefing from your goals, tasks, habits, today\'s calendar, and unread inbox — your top 3, anything overdue, and habits at risk. Open the Briefing tab each morning.',
        tag: 'Daily',
      },
      {
        title: 'It nudges you about people you\'re leaving hanging',
        body: 'MODUS notices contacts who emailed you and never got a reply, and flags the most overdue ones so relationships don\'t go cold.',
      },
    ],
  },
  {
    heading: 'Integrations',
    icon: '🔌',
    tips: [
      {
        title: 'Connect Google to unlock Calendar + Gmail',
        body: 'Settings → Connectors → Google. Once connected, MODUS can see your inbox, schedule events in Google Calendar, archive emails, and draft or send replies.',
        tag: 'Setup',
      },
      {
        title: 'Ask MODUS to connect from chat',
        body: 'If you haven\'t connected an integration, just ask MODUS to use it ("show me my emails"). It drops a connect card in the chat so you don\'t have to dig through settings.',
      },
    ],
  },
  {
    heading: 'Memory',
    icon: '🧠',
    tips: [
      {
        title: 'MODUS builds a profile of you over time',
        body: 'With "Generate memory from chat" enabled (Settings → Memory), MODUS extracts key facts from your conversations — your preferences, recurring goals, communication style.',
      },
      {
        title: 'Add memories manually',
        body: 'Settings → Memory → Add. Useful for things like "I work across Pacific and Eastern time", "My launch date is June 1", "My co-founder is Alex".',
        tag: 'Pro tip',
      },
    ],
  },
  {
    heading: 'Goals & habits',
    icon: '🎯',
    tips: [
      {
        title: 'Let MODUS build your plan',
        body: 'On any goal, ask MODUS to generate a milestone checklist tailored to your goal and timeframe. Your progress % then updates automatically as you check milestones off.',
        tag: 'AI',
      },
      {
        title: 'Use goal chats to think, not just track',
        body: 'Each goal has its own MODUS chat with full context on that goal. Use it to think out loud: "what\'s blocking me?", "help me plan next steps", "reflect on this week".',
      },
    ],
  },
];

export default function TipsScreen() {
  const [open, setOpen] = useState<string | null>(SECTIONS[0].heading);

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <ScreenHeader title="Tips & Tricks" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-muted text-sm mb-4">
          Everything you can do in MODUS — and how to get the most out of it.
        </Text>

        <View className="gap-3">
          {SECTIONS.map(section => (
            <Accordion
              key={section.heading}
              section={section}
              isOpen={open === section.heading}
              onToggle={() => setOpen(open === section.heading ? null : section.heading)}
            />
          ))}
        </View>

        <View className="bg-brand/5 border border-brand/20 rounded-xl px-5 py-4 mt-4">
          <Text className="text-text font-semibold mb-1">Still figuring something out?</Text>
          <Text className="text-muted text-xs leading-5">
            Ask MODUS directly in chat — it knows everything about itself and can walk you through any feature.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Accordion({ section, isOpen, onToggle }: { section: Section; isOpen: boolean; onToggle: () => void }) {
  const rotate = useSharedValue(isOpen ? 1 : 0);
  rotate.value = withTiming(isOpen ? 1 : 0, { duration: 180 });
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value * 180}deg` }] }));

  return (
    <View className="bg-surface border border-border rounded-xl overflow-hidden">
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        className="flex-row items-center gap-3 px-4 py-4"
      >
        <Text className="text-base">{section.icon}</Text>
        <Text className="text-text font-semibold text-[15px] flex-1">{section.heading}</Text>
        <View className="bg-border rounded-full px-2 py-0.5">
          <Text className="text-muted text-[10px] font-semibold">{section.tips.length}</Text>
        </View>
        <Animated.View style={chevronStyle}>
          <Icon name="keyboard-arrow-down" tone="muted" size={20} />
        </Animated.View>
      </TouchableOpacity>

      {isOpen && (
        <View className="border-t border-border">
          {section.tips.map((tip, i) => (
            <View key={tip.title} className={`px-4 py-4 ${i > 0 ? 'border-t border-border/60' : ''}`}>
              <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                <Text className="text-text font-medium text-sm">{tip.title}</Text>
                {tip.tag && (
                  <View className="bg-brand/10 rounded-full px-2 py-0.5">
                    <Text className="text-brand text-[10px] font-semibold">{tip.tag}</Text>
                  </View>
                )}
              </View>
              <Text className="text-muted text-xs leading-5">{tip.body}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
