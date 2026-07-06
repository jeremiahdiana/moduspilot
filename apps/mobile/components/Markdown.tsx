import React from 'react';
import { View, Text, Platform } from 'react-native';

/**
 * Minimal markdown renderer for chat — dependency-free (no native libs).
 * Handles headings, bullet/numbered lists, task lists, GFM tables, fenced code
 * blocks, bold, italic, and inline code. Anything else renders as plain text.
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

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const parseRow = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

export function Markdown({ text, className = 'text-text' }: { text: string; className?: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: React.ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // Fenced code block
    if (/^```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { code.push(lines[i]); i++; }
      if (i < lines.length) i++; // skip closing fence
      blocks.push(
        <View key={key++} className="rounded-lg border border-border bg-panel px-3 py-2.5">
          <Text selectable style={{ fontFamily: MONO }} className="text-[13px] leading-5 text-text">{code.join('\n')}</Text>
        </View>,
      );
      continue;
    }

    // GFM table (header row followed by a | --- | separator)
    if (isTableRow(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const header = parseRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) { rows.push(parseRow(lines[i])); i++; }
      blocks.push(
        <View key={key++} className="rounded-lg border border-border overflow-hidden">
          <View className="flex-row bg-panel">
            {header.map((h, ci) => (
              <Text key={ci} className="flex-1 px-2.5 py-2 text-xs font-semibold text-muted">{h}</Text>
            ))}
          </View>
          {rows.map((r, ri) => (
            <View key={ri} className="flex-row border-t border-border">
              {r.map((c, ci) => (
                <Text key={ci} className={`flex-1 px-2.5 py-2 text-xs ${ci === 0 ? 'text-text font-medium' : 'text-text'}`}>
                  {renderInline(c, `td${key}-${ri}-${ci}`)}
                </Text>
              ))}
            </View>
          ))}
        </View>,
      );
      continue;
    }

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

    // Bullet list (incl. task-list items)
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <View key={key++} className="gap-1">
          {items.map((it, idx) => {
            const task = it.match(/^\[([ xX])\]\s+(.*)$/);
            if (task) {
              const checked = task[1].toLowerCase() === 'x';
              return (
                <View key={idx} className="flex-row gap-2 items-start">
                  <View className={`w-4 h-4 rounded border items-center justify-center mt-1 ${checked ? 'bg-brand/20 border-brand' : 'border-border'}`}>
                    {checked && <Text className="text-brand text-[10px] leading-none">✓</Text>}
                  </View>
                  <Text className={`${className} text-base leading-6 flex-1`}>{renderInline(task[2], `tl${key}-${idx}`)}</Text>
                </View>
              );
            }
            return (
              <View key={idx} className="flex-row gap-2">
                <Text className={`${className} text-base leading-6`}>•</Text>
                <Text className={`${className} text-base leading-6 flex-1`}>{renderInline(it, `bl${key}-${idx}`)}</Text>
              </View>
            );
          })}
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
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !isTableRow(lines[i])
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
