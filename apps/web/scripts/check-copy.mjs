#!/usr/bin/env node
/**
 * Copy guard for MODUS user-facing text.
 *
 * The house style bans em dashes (—), en dashes (–) and emoji in anything a user
 * reads. That rule was only ever enforced on AI-generated text at runtime; static
 * TSX copy drifted. This walks the TypeScript AST and inspects ONLY string
 * literals, template literals and JSX text — never comments — so the emoji and
 * dashes that live in code comments are left alone, and only real copy is flagged.
 *
 * Scope: app/** UI (pages, layouts) and components/**. app/api/** is excluded on
 * purpose — those strings are model prompts and server logs, not user-facing copy,
 * and the em-dash rule for model output is enforced inside the prompts themselves.
 *
 * Run: node scripts/check-copy.mjs   (exits 1 on any violation)
 *
 * Nav-arrow glyphs (→ ← ↑ ↓) are intentionally allowed; they are not emoji.
 *
 * Emoji rule: em/en dashes are banned in ALL copy. Emoji are banned only when they
 * sit inside PROSE — a string with a run of three or more words — so functional UI
 * iconography (weather widget, energy states, streak flames, checkmarks, the
 * project-type icon picker, section icons) is left intact. That is the founder's
 * call: dashes everywhere, prose emoji only.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import ts from 'typescript';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['app', 'components'];
const EXT = new Set(['.ts', '.tsx']);

const EM_DASH = '—';
const EN_DASH = '–';
// Emoji ranges only — arrows (←–⇿) are deliberately excluded.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️\u{1F1E6}-\u{1F1FF}]/u;

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      walk(full, out);
    } else if (EXT.has(full.slice(full.lastIndexOf('.')))) {
      out.push(full);
    }
  }
  return out;
}

function check(text, kind, node, sf, file, findings) {
  if (text == null) return;
  // "Prose" = a run of three or more alphabetic words; emoji are only banned there.
  const isProse = /[A-Za-z]+(?:['’A-Za-z]*\s+[A-Za-z]['’A-Za-z]*){2,}/.test(text);
  let reason = '';
  if (text.includes(EM_DASH)) reason = 'em dash (—)';
  else if (text.includes(EN_DASH)) reason = 'en dash (–)';
  else if (isProse && EMOJI.test(text)) reason = 'emoji in prose';
  if (!reason) return;
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 80);
  findings.push(`${relative(WEB_ROOT, file)}:${line + 1}:${character + 1}  ${reason}  ·  ${kind}: "${snippet}"`);
}

function scanFile(file, findings) {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      check(node.text, 'string', node, sf, file, findings);
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      check(node.text, 'template', node, sf, file, findings);
    } else if (ts.isJsxText(node)) {
      check(node.text, 'jsx', node, sf, file, findings);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

const API_DIR = join(WEB_ROOT, 'app', 'api');
const files = [];
for (const d of DIRS) walk(join(WEB_ROOT, d), files);
const scoped = files.filter((f) => !f.startsWith(API_DIR));

const findings = [];
for (const f of scoped) scanFile(f, findings);

if (findings.length) {
  console.error(`\ncheck-copy: ${findings.length} banned character(s) in user-facing copy:\n`);
  for (const f of findings) console.error('  ' + f);
  console.error('\nRewrite the copy (comma / colon / period / sentence split). Comments are exempt.\n');
  process.exit(1);
}
console.log(`check-copy: clean (${scoped.length} files scanned).`);
