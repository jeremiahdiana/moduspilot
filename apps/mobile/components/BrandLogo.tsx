import Svg, { Path } from 'react-native-svg';
import { useThemeColors } from '@/lib/theme';

// Real brand/provider logos for native screens (connectors, model switcher),
// replacing the generic Material glyphs that don't carry a brand's identity.
// Multicolor marks use fixed brand colors; monochrome marks (Notion, GitHub,
// Apple, Auto) inherit a passed/theme color so they read in light & dark.

type Props = { size?: number; color?: string };

export function GoogleLogo({ size = 18 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <Path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <Path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z" />
      <Path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1C6.2 6.9 8.9 4.8 12 4.8z" />
    </Svg>
  );
}

export function NotionLogo({ size = 18, color = '#111111' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </Svg>
  );
}

export function SlackLogo({ size = 18 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#36C5F0" d="M9.04 2.5a2.4 2.4 0 1 0 0 4.81h2.41V4.9a2.4 2.4 0 0 0-2.4-2.4zM9.04 8.9H2.6a2.4 2.4 0 1 0 0 4.81h6.44a2.4 2.4 0 1 0 0-4.81z" />
      <Path fill="#2EB67D" d="M21.5 11.3a2.4 2.4 0 1 0-4.81 0v2.41h2.4a2.4 2.4 0 0 0 2.41-2.4zM15.1 11.3V4.86a2.4 2.4 0 1 0-4.81 0v6.44a2.4 2.4 0 1 0 4.81 0z" />
      <Path fill="#ECB22E" d="M12.7 21.5a2.4 2.4 0 1 0 0-4.81h-2.4v2.4a2.4 2.4 0 0 0 2.4 2.41zM12.7 15.1h6.44a2.4 2.4 0 1 0 0-4.81H12.7a2.4 2.4 0 1 0 0 4.81z" />
      <Path fill="#E01E5A" d="M2.5 12.7a2.4 2.4 0 1 0 4.81 0v-2.4H4.9a2.4 2.4 0 0 0-2.4 2.4zM8.9 12.7v6.44a2.4 2.4 0 1 0 4.81 0V12.7a2.4 2.4 0 1 0-4.81 0z" />
    </Svg>
  );
}

export function GithubLogo({ size = 18, color = '#111111' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </Svg>
  );
}

export function AppleLogo({ size = 18, color = '#111111' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M17.05 12.54c-.03-3.2 2.62-4.74 2.74-4.82-1.5-2.18-3.82-2.48-4.64-2.52-1.98-.2-3.86 1.16-4.86 1.16s-2.54-1.13-4.18-1.1c-2.15.03-4.14 1.25-5.24 3.18-2.24 3.87-.57 9.6 1.6 12.74 1.07 1.54 2.34 3.26 4 3.2 1.6-.06 2.22-1.04 4.16-1.04s2.49 1.04 4.19 1.01c1.73-.03 2.82-1.57 3.88-3.11 1.22-1.79 1.72-3.52 1.75-3.6-.04-.02-3.36-1.29-3.4-5.1zM13.87 3.85c.88-1.07 1.48-2.56 1.32-4.05-1.27.05-2.82.85-3.73 1.92-.82.95-1.54 2.47-1.35 3.92 1.42.11 2.87-.72 3.76-1.79z" />
    </Svg>
  );
}

export function OpenAILogo({ size = 18, color = '#111111' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A5.98 5.98 0 0 0 10.75 0a6.05 6.05 0 0 0-5.77 4.19 5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .75 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9A5.98 5.98 0 0 0 13.25 24a6.05 6.05 0 0 0 5.77-4.2 5.98 5.98 0 0 0 4-2.9 6.05 6.05 0 0 0-.74-7.08zM13.25 22.43a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.78.78 0 0 0 .4-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.5 4.5zM3.6 18.3a4.47 4.47 0 0 1-.54-3.01l.14.08 4.78 2.76a.78.78 0 0 0 .78 0l5.84-3.37v2.33a.07.07 0 0 1-.03.06l-4.83 2.79a4.5 4.5 0 0 1-6.14-1.64zM2.34 7.9a4.48 4.48 0 0 1 2.35-1.97v5.68a.78.78 0 0 0 .39.68l5.83 3.36-2.02 1.17a.07.07 0 0 1-.07 0l-4.83-2.8A4.5 4.5 0 0 1 2.34 7.9zm16.6 3.86-5.84-3.37 2.02-1.16a.07.07 0 0 1 .07 0l4.83 2.78a4.5 4.5 0 0 1-.68 8.12v-5.69a.78.78 0 0 0-.4-.68zm2.01-3.02-.14-.09-4.77-2.77a.78.78 0 0 0-.79 0L9.42 7.2V4.87a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.66zM8.32 12.87 6.3 11.7a.07.07 0 0 1-.04-.05V6.08a4.5 4.5 0 0 1 7.38-3.45l-.14.08L8.72 5.47a.78.78 0 0 0-.4.68zm1.1-2.37 2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5z" />
    </Svg>
  );
}

export function AnthropicLogo({ size = 18, color = '#D97757' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M6.5 4h3l6.16 16h-3l-1.22-3.2H4.9L3.68 20h-3L6.5 4zm1.5 3.9L5.77 13.8h4.46L8 7.9z" />
      <Path fill={color} d="M14.83 4h3.02L24 20h-3.02l-6.15-16z" />
    </Svg>
  );
}

export function GeminiLogo({ size = 18 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M12 2c.3 4.4 2.4 8 7.6 8-5.2 0-7.3 3.6-7.6 8-.3-4.4-2.4-8-7.6-8C9.6 10 11.7 6.4 12 2z" />
    </Svg>
  );
}

export function XaiLogo({ size = 16, color = '#111111' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M3 3h3.6l5 7-5 7H3l5-7zm12.8 0H19l-4.3 6-1.8-2.5zm-1.3 11.9 1.8 2.6L13.7 21h-3.2z" />
    </Svg>
  );
}

export function MetaLogo({ size = 18 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#0866FF" d="M3 15.5c0-3.6 1.6-7 4-7 1.7 0 3 1.6 4.9 4.7 2 3.3 3.1 4.8 4.7 4.8 1.5 0 2.4-1.6 2.4-4 0-2.7-1.1-4.5-2.6-4.5-1.2 0-2.3 1-3.8 3.4l-1.2-1.9C15.2 8.2 16.7 7 18.4 7 21 7 23 9.8 23 14c0 3.4-1.6 5.5-4 5.5-1.9 0-3.2-1.2-5.1-4.3C12 12 11 10.5 9.7 10.5c-1 0-1.9 1.4-1.9 3.8 0 1 .2 1.9.4 2.5l-2 .6C3.7 16.5 3 15.7 3 15.5z" />
    </Svg>
  );
}

// Connector providers (connectors.tsx). Monochrome marks take the theme text color.
export function BrandLogo({ provider, size = 18 }: { provider: string; size?: number }) {
  const c = useThemeColors();
  const p = provider.toLowerCase();
  if (p === 'google') return <GoogleLogo size={size} />;
  if (p === 'notion') return <NotionLogo size={size} color={c.text} />;
  if (p === 'slack') return <SlackLogo size={size} />;
  if (p === 'github') return <GithubLogo size={size} color={c.text} />;
  return null;
}

// AI providers (model switcher / model-settings). Provider strings match lib/models.ts.
export function ProviderLogo({ provider, size = 18 }: { provider: string; size?: number }) {
  const c = useThemeColors();
  const p = provider.toLowerCase();
  if (p.includes('openai')) return <OpenAILogo size={size} color={c.text} />;
  if (p.includes('anthropic')) return <AnthropicLogo size={size} />;
  if (p.includes('google')) return <GeminiLogo size={size} />;
  if (p.includes('xai')) return <XaiLogo size={size} color={c.text} />;
  if (p.includes('meta') || p.includes('groq') || p.includes('llama')) return <MetaLogo size={size} />;
  return null;
}
