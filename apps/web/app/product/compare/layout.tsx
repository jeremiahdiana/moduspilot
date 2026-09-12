import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compare models | Modus',
  description: 'Every frontier model in one chat: Claude, GPT-5.6, Gemini, Llama and DeepSeek. Leave it on Auto or pick per message. Free on the open models.',
  alternates: { canonical: 'https://moduspilot.com/product/compare' },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
