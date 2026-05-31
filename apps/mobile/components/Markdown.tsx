import React from 'react';
import { View, Text, Platform } from 'react-native';

/**
 * Minimal markdown renderer for chat — dependency-free (no native libs).
 * Handles headings, bullet/numbered lists, bold, italic, and inline code.
 * Anything it doesn't recognise renders as plain text.
 */

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const INLINE_RE = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*\n]+)\*)/g;

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(<Text key={`${keyBase}-t${i++}`}>{text.slice(last, m.index)}</Text>);
    if (m[2] !== undefined || m[3] !== undefined) {
      nodes.push(<Text key={`${keyBase}-b${i++}`} className="font-semibold">{m[2] ?? m[3]}</Text>);
    } else if (m[4] !== undefined) {
      nodes.push(
        <Text key={`${keyBase}-c${i++}`} className="text-brand" style={{ fontFamily: MONO }}>{m[4]}</Text>,
      );
    } else if (m[5] !== undefined) {
      nodes.push(<Text key={`${keyBase}-i${i++}`} className="italic">{m[5]}</Text>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(<Text key={`${keyBase}-t${i++}`}>{text.slice(last)}</Text>);
  return nodes;
}

export function Markdown({ text, className = 'text-text' }: { text: string; className?: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: React.ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // Heading
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const size = h[1].length === 1 ? 'text-xl' : h[1].length === 2 ? 'text-lg' : 'text-base';
      blocks.push(
        <Text key={key++} className={`${className} ${size} font-bold leading-6`}>
          {renderInline(h[2], `h${key}`)}
        </Text>,
      );
      i++;
      continue;
    }

    // Bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <View key={key++} className="gap-1">
          {items.map((it, idx) => (
            <View key={idx} className="flex-row gap-2">
              <Text className={`${className} text-base leading-6`}>•</Text>
              <Text className={`${className} text-base leading-6 flex-1`}>{renderInline(it, `bl${key}-${idx}`)}</Text>
            </View>
          ))}
        </View>,
      );
      continue;
    }

    // Numbered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: { n: string; t: string }[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const m = lines[i].match(/^\s*(\d+)\.\s+(.*)$/)!;
        items.push({ n: m[1], t: m[2] });
        i++;
      }
      blocks.push(
        <View key={key++} className="gap-1">
          {items.map((it, idx) => (
            <View key={idx} className="flex-row gap-2">
              <Text className={`${className} text-base leading-6`}>{it.n}.</Text>
              <Text className={`${className} text-base leading-6 flex-1`}>{renderInline(it.t, `nl${key}-${idx}`)}</Text>
            </View>
          ))}
        </View>,
      );
      continue;
    }

    // Paragraph (gather consecutive non-blank, non-special lines)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <Text key={key++} className={`${className} text-base leading-6`}>
        {renderInline(para.join('\n'), `p${key}`)}
      </Text>,
    );
  }

  return <View className="gap-2">{blocks}</View>;
}
