import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';

export const metadata: Metadata = {
  title: 'Privacy Policy — MODUS',
  description: 'How MODUS collects, uses, and protects your data.',
  alternates: { canonical: 'https://moduspilot.com/privacy' },
};

const LAST_UPDATED = 'May 23, 2025';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-text">{title}</h2>
      <div className="text-sm text-muted leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="bg-bg text-text min-h-screen">
      <Navbar solid />
      <div className="pt-16 max-w-2xl mx-auto px-6 py-16 space-y-10">

        <div>
          <p className="text-xs font-semibold text-brand uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-3xl font-black text-text mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted">Last updated: {LAST_UPDATED}</p>
        </div>

        <Section title="Overview">
          <p>MODUS Pilot ("MODUS", "we", "us") is an AI-powered personal operating system. This policy explains what data we collect, how we use it, and your rights. By using MODUS you agree to this policy.</p>
        </Section>

        <Section title="Information We Collect">
          <p><span className="text-text font-medium">Account data:</span> Your name, email address, and profile photo when you sign in via Google or Apple.</p>
          <p><span className="text-text font-medium">Conversation data:</span> Messages you send to MODUS and AI responses, stored in your account to provide conversation history and context.</p>
          <p><span className="text-text font-medium">Goals, tasks, and habits:</span> Data you create inside MODUS — goals, tasks, habits, and memories — stored to power the app experience.</p>
          <p><span className="text-text font-medium">Google account data (if connected):</span> When you connect Google, MODUS accesses your Gmail, Google Calendar, and Google Drive using OAuth 2.0. We read email and calendar data to populate your daily briefing. We send emails only when you explicitly approve an action. We read Drive files to provide document context in chat. We never store your full email content — only metadata and snippets needed for briefing generation.</p>
          <p><span className="text-text font-medium">Usage data:</span> Daily message counts, plan status, and basic analytics to operate the service.</p>
        </Section>

        <Section title="How We Use Your Data">
          <p>We use your data exclusively to operate MODUS:</p>
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>Generating your daily briefing from your calendar, email, goals, and tasks</li>
            <li>Providing AI responses with relevant context from your memory and history</li>
            <li>Sending emails and creating calendar events on your behalf when you approve</li>
            <li>Tracking habits, streaks, and goal progress</li>
            <li>Enforcing plan limits and processing payments via Stripe</li>
          </ul>
          <p>We do not sell your data, use it to train AI models, or share it with third parties except as described below.</p>
        </Section>

        <Section title="Google API Data">
          <p>MODUS use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
          <p>Specifically:</p>
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>We only access Google data that is necessary to provide the MODUS service</li>
            <li>We do not use Google data to serve ads</li>
            <li>We do not allow humans to read your Google data unless you explicitly ask for support and grant permission</li>
            <li>We do not transfer Google data to third parties except to operate the service (e.g. AI inference via Groq)</li>
            <li>We store OAuth tokens encrypted and refresh them automatically</li>
            <li>You can disconnect Google at any time from Settings → Connectors</li>
          </ul>
        </Section>

        <Section title="Data Storage and Security">
          <p>Your data is stored in Google Firebase (Firestore) and Pinecone (vector memory), both in the United States. We use industry-standard security practices including encrypted transport (HTTPS), token-based authentication, and Firestore security rules that prevent any user from accessing another user's data.</p>
          <p>OAuth tokens are stored encrypted server-side and are never exposed to the client.</p>
        </Section>

        <Section title="Data Retention">
          <p>Conversation history is retained for 2 years, or until you delete your account.</p>
          <p>You can delete your account and all associated data at any time from Settings → Account → Delete Account. Deletion is immediate and irreversible.</p>
        </Section>

        <Section title="Third-Party Services">
          <p>MODUS uses the following third-party services to operate:</p>
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li><span className="text-text font-medium">Groq</span> — AI inference (your messages are sent to Groq for processing)</li>
            <li><span className="text-text font-medium">Pinecone</span> — Vector memory storage</li>
            <li><span className="text-text font-medium">Stripe</span> — Payment processing (we never see or store your card details)</li>
            <li><span className="text-text font-medium">Firebase / Google Cloud</span> — Authentication and database</li>
            <li><span className="text-text font-medium">Vercel</span> — Hosting and deployment</li>
          </ul>
        </Section>

        <Section title="Your Rights">
          <p>You have the right to:</p>
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>Access all data stored about you</li>
            <li>Delete your account and all data at any time</li>
            <li>Disconnect Google and revoke all OAuth access at any time</li>
            <li>Opt out of data being used to improve MODUS (Settings → Privacy)</li>
            <li>Export your data — contact us at the email below</li>
          </ul>
        </Section>

        <Section title="Children">
          <p>MODUS is not directed at children under 13. We do not knowingly collect data from children under 13.</p>
        </Section>

        <Section title="Changes to This Policy">
          <p>We may update this policy from time to time. We will notify you of material changes via email or in-app notification. Continued use of MODUS after changes constitutes acceptance.</p>
        </Section>

        <Section title="Contact">
          <p>Questions about this policy? Email us at <a href="mailto:support@moduspilot.com" className="text-brand hover:underline">support@moduspilot.com</a>.</p>
        </Section>

        <div className="pt-6 border-t border-border flex items-center justify-between text-xs text-muted">
          <span>© {new Date().getFullYear()} MODUS Pilot</span>
          <Link href="/terms" className="hover:text-text transition-colors">Terms of Service →</Link>
        </div>
      </div>
    </div>
  );
}
