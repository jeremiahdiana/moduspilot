'use client';

import { useState } from 'react';

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

const SECTIONS: Section[] = [
  {
    heading: 'Navigation',
    icon: '⌨️',
    tips: [
      {
        title: 'Rename any chat',
        body: 'Double-click a conversation title in the sidebar — or in a goal\'s chat tabs — to rename it inline. Hit Enter or click away to save.',
        tag: 'Double-click',
      },
      {
        title: 'Jump to settings from anywhere',
        body: 'Press Cmd+K (or Ctrl+K) to open the command bar. Type "settings", "billing", "memory", or any tab name to jump straight there.',
        tag: 'Cmd+K',
      },
      {
        title: 'Switch goals fast',
        body: 'The Goals page shows all your active goals. Click any card to open its full detail view — progress, milestones, tasks, habits, and a dedicated MODUS chat.',
      },
    ],
  },
  {
    heading: 'Using MODUS AI',
    icon: '🤖',
    tips: [
      {
        title: 'Approval cards — approve, edit, or skip',
        body: 'When MODUS proposes an action (create goal, schedule event, send email), it surfaces an approval card. You can approve it as-is, hit Edit to change the title, or Skip to ignore it. Nothing executes until you say so.',
        tag: 'Core mechanic',
      },
      {
        title: 'Ask MODUS to create things from chat',
        body: 'Say "add that as a goal", "create a task for X", "add a daily habit for Y", or "schedule that for Thursday at 3pm" — MODUS will surface the right card immediately.',
      },
      {
        title: 'Email reply drafting',
        body: 'Paste an email and say "draft a reply". MODUS will ask you to pick a tone (Optimistic, Candid, Strategic) before writing — so your reply actually sounds like you. Then you approve the send.',
        tag: 'Workflow',
      },
      {
        title: 'Schedule straight from an email',
        body: 'Paste or forward an email and say "put this on my calendar". MODUS pulls out the date and time and surfaces a calendar hold — approve it and the event lands in Google Calendar.',
        tag: 'Cross-tool',
      },
      {
        title: 'Update goal progress with words',
        body: 'Just say "I\'m about 60% done with my YC application goal" and MODUS will surface an update_goal_progress card with the slider pre-set.',
      },
      {
        title: 'Tell MODUS who you are',
        body: 'Go to Settings → General → Personal Context. Write 2–5 sentences about your role, how you like to work, and your priorities. MODUS reads this in every conversation.',
        tag: 'Setup tip',
      },
    ],
  },
  {
    heading: 'Your Brain — AI model selection',
    icon: '🧠',
    tips: [
      {
        title: 'Switch your AI in Settings → Brain',
        body: 'MODUS runs on 6 AI models. Go to Settings → Brain to pick one. Llama 3.3 is fast and always free. GPT-5.6 Terra, Claude Sonnet 5, and Gemini 3.5 Flash unlock on MODUS ($24/mo). GPT-5.6 Sol, Claude Opus and Claude Fable 5 unlock on PILOT ($59/mo).',
        tag: 'Feature',
      },
      {
        title: 'All features work on every Brain',
        body: 'Your memory, inbox triage, approval cards, and integrations work identically no matter which Brain you pick. The Brain only changes which AI model answers your chat messages.',
      },
      {
        title: 'Use your own API key',
        body: 'Have your own OpenAI or Anthropic subscription? Settings → Brain → "Use your own subscription". Your key overrides the platform Brain and routes chat directly through your account.',
        tag: 'BYOK',
      },
      {
        title: 'Pick Claude for writing, GPT-5.6 for general use',
        body: 'Claude Sonnet is exceptional for nuanced writing, editing, and analysis. GPT-5.6 Terra handles images and code well. Gemini 3.5 Flash is the fastest. GPT-5.6 Sol is best for hard math and logic. Try a few and see what fits your workflow.',
        tag: 'Pro tip',
      },
    ],
  },
  {
    heading: 'Proactive — MODUS works on its own',
    icon: '✨',
    tips: [
      {
        title: 'MODUS triages your inbox for you',
        body: 'Through the day MODUS scans your connected inbox for emails waiting on a reply, drafts a response in your voice, and drops it in chat with a push notification. Approve, edit, or skip — nothing sends until you tap. Turn it off in the Capabilities page → Inbox Triage.',
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
        body: 'At the time you set (Settings → General), MODUS generates a briefing from your goals, tasks, habits, today\'s calendar, and unread inbox — your top 3, anything overdue, and habits at risk of breaking streak. Turn it off in the Capabilities page → Daily Briefing.',
        tag: 'Daily',
      },
      {
        title: 'Relationship follow-up nudges',
        body: 'MODUS notices contacts who emailed you and never got a reply, and flags the most overdue ones so relationships don\'t go cold. Enable in the Capabilities page → Relationship Follow-ups.',
      },
    ],
  },
  {
    heading: 'Integrations',
    icon: '🔌',
    tips: [
      {
        title: 'Connect Google to unlock Calendar + Gmail',
        body: 'the Capabilities page → Google. Once connected, MODUS can see your inbox, schedule events directly in Google Calendar, archive emails, and draft or send replies.',
        tag: 'Setup',
      },
      {
        title: 'Multi-account Gmail',
        body: 'If you have multiple Google accounts connected, MODUS will let you pick which inbox to send from when you approve a send_email card.',
      },
      {
        title: 'Ask MODUS to connect from chat',
        body: 'If you haven\'t connected an integration, just ask MODUS to use it ("show me my emails"). It will drop a connect card in the chat so you don\'t have to go to settings.',
      },
      {
        title: 'On iOS — health, contacts, and files',
        body: 'In the MODUS iOS app, go to the Capabilities page → On This Device to enable Health (steps + sleep in your briefing), Contacts (for relationship tracking), Photos, and Files (including Obsidian notes via iCloud Drive).',
        tag: 'iOS',
      },
      {
        title: 'Share files to MODUS on iOS',
        body: 'In the iOS app: the Capabilities page → Files & Notes → Browse. Pick any text or Markdown file from iCloud Drive. MODUS opens a chat with the file contents ready to discuss — great for Obsidian notes, meeting transcripts, or strategy docs.',
        tag: 'iOS',
      },
    ],
  },
  {
    heading: 'Memory',
    icon: '💾',
    tips: [
      {
        title: 'MODUS builds a profile of you over time',
        body: 'With "Generate Memory from Chat History" enabled (Settings → Brain), MODUS extracts key facts from your conversations — your preferences, recurring goals, communication style.',
      },
      {
        title: 'Add memories manually',
        body: 'Go to Settings → Brain → Add Memory. Useful for things like: "I work across Pacific and Eastern time zones", "My launch date is June 1", "My co-founder is named Alex".',
        tag: 'Pro tip',
      },
      {
        title: 'Import from ChatGPT',
        body: 'If you\'ve been using ChatGPT\'s memory, you can export your memories from ChatGPT (Settings → Data controls → Export) and import the JSON directly in Settings → Brain.',
      },
    ],
  },
  {
    heading: 'Goals & Milestones',
    icon: '🎯',
    tips: [
      {
        title: 'Edit a milestone inline',
        body: 'Click any milestone title in a goal detail page to edit it in place. Enter saves, Escape cancels. The × that appears on hover deletes it.',
        tag: 'Click to edit',
      },
      {
        title: 'Let MODUS build your plan',
        body: 'Hit "✦ Generate plan" on any goal and MODUS will create a milestone checklist tailored to your goal title and timeframe. You can regenerate any time.',
        tag: 'AI',
      },
      {
        title: 'Progress syncs from milestones',
        body: 'When milestones exist, your progress % is calculated automatically as you check them off. No manual slider needed.',
      },
      {
        title: 'Use goal chats to think, not just track',
        body: 'Each goal has its own MODUS chat. Use it to think out loud: "what\'s blocking me on this?", "help me plan next steps", "reflect on what I shipped this week". MODUS has full context on the goal.',
      },
      {
        title: 'Log wins, blockers, and ideas',
        body: 'Open the Notes tab on any goal. Tag each note as a Win, Blocker, Idea, or Reflection — then filter to see just blockers when you\'re stuck, or just wins when you need a boost.',
      },
    ],
  },
  {
    heading: 'Optimizing your workflow',
    icon: '⚡',
    tips: [
      {
        title: 'Open MODUS first thing in the morning',
        body: 'MODUS drops a daily briefing at your configured time (Settings → General). It covers your top 3 for the day, anything overdue, and habits at risk of breaking streak.',
        tag: 'Daily habit',
      },
      {
        title: 'Create multiple chat threads per goal',
        body: 'Hit "+ New" in a goal\'s chat tabs to start a focused thread (e.g., one for strategy, one for blockers). Double-click the tab to rename it.',
        tag: 'Pro tip',
      },
      {
        title: 'Set up your response style',
        body: 'Settings → General → Response Style. Choose Direct, Concise, Strategic, Coach, or Supportive — or write your own. This changes how MODUS communicates with you across every conversation.',
        tag: 'Personalization',
      },
      {
        title: 'Trigger inbox triage manually',
        body: 'Go to Briefing → Inbox and tap "Triage inbox". MODUS will immediately scan your email and generate draft replies for emails waiting on you — without waiting for the hourly cron.',
      },
    ],
  },
];

export default function TipsSettings() {
  const [openSection, setOpenSection] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Tips & Tricks</h2>
        <p className="text-sm text-muted">Everything you can do in MODUS — and how to get the most out of it.</p>
      </div>

      <div className="space-y-3">
        {SECTIONS.map(section => {
          const isOpen = openSection === section.heading;
          return (
            <div key={section.heading} className="bg-panel border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenSection(isOpen ? null : section.heading)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-bg/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-base">{section.icon}</span>
                  <span className="text-sm font-semibold text-text">{section.heading}</span>
                  <span className="text-[10px] font-medium text-muted bg-border px-2 py-0.5 rounded-full">
                    {section.tips.length}
                  </span>
                </div>
                <svg
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round"
                  className={`w-4 h-4 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isOpen && (
                <div className="border-t border-border divide-y divide-border/60">
                  {section.tips.map(tip => (
                    <div key={tip.title} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-sm font-medium text-text">{tip.title}</p>
                            {tip.tag && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                                {tip.tag}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted leading-relaxed">{tip.body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-brand/5 border border-brand/20 rounded-xl px-5 py-4">
        <p className="text-sm font-semibold text-text mb-1">Still figuring something out?</p>
        <p className="text-xs text-muted">Ask MODUS directly in chat — it knows everything about itself and can walk you through any feature.</p>
      </div>
    </div>
  );
}
