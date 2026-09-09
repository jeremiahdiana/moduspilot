import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Integrations — Modus',
  description: 'Connect your inbox, calendar, files and apps: Gmail, Outlook, Google Calendar, Drive, Notion, Slack, GitHub, Apple apps, Plaid, wearables and any MCP server.',
  alternates: { canonical: 'https://moduspilot.com/product/integrations' },
};

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
