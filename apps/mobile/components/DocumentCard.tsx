import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Share, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Icon } from '@/components/Icon';
import { useThemeColors } from '@/lib/theme';
import { Markdown } from '@/components/Markdown';

interface DocPayload { title?: string; markdown?: string }

// Same stable key as the web canvas (lib/document.ts docKey) so a document's
// edits persist to users/{uid}/documents/{key} and sync across web + mobile.
function docKey(title: string, markdown: string): string {
  const s = `${title}\n${markdown}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `d${(h >>> 0).toString(36)}`;
}

// MODUS document canvas (mobile). Renders the document inline and opens a
// full-screen workspace to edit it (markdown editor + live preview) with edits
// persisted to Firestore. Exports a real PDF via expo-print + expo-sharing;
// falls back to a plaintext Share sheet if those native modules aren't in the
// running binary yet.
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export function DocumentCard({ raw }: { raw: string }) {
  const c = useThemeColors();
  let data: DocPayload;
  try { data = JSON.parse(raw); } catch { data = { markdown: raw }; }
  const origTitle = (data.title ?? 'Document').trim();
  const origMarkdown = (data.markdown ?? '').trim();
  const key = docKey(origTitle, origMarkdown);

  const [title, setTitle] = useState(origTitle);
  const [markdown, setMarkdown] = useState(origMarkdown);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [draftTitle, setDraftTitle] = useState(origTitle);
  const [draftMd, setDraftMd] = useState(origMarkdown);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, 'users', uid, 'documents', key)).then(snap => {
      const d = snap.data();
      if (d) {
        if (d.title) setTitle(d.title as string);
        if (typeof d.markdown === 'string') setMarkdown(d.markdown);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEditor() {
    setDraftTitle(title);
    setDraftMd(markdown);
    setMode('edit');
    setEditing(true);
  }

  async function saveEdits() {
    setTitle(draftTitle);
    setMarkdown(draftMd);
    const uid = auth.currentUser?.uid;
    if (uid) {
      setSaving(true);
      try {
        await setDoc(doc(db, 'users', uid, 'documents', key), {
          title: draftTitle, markdown: draftMd, updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch { /* stays in session even if the write fails */ }
      finally { setSaving(false); }
    }
    setEditing(false);
  }

  function share(t: string, md: string) {
    Share.share({ title: t, message: `${t}\n\n${md}` }).catch(() => {});
  }

  const [exporting, setExporting] = useState(false);
  async function exportPdf(t: string, md: string) {
    setExporting(true);
    try {
      const [Print, Sharing, { marked }] = await Promise.all([
        import('expo-print'),
        import('expo-sharing'),
        import('marked'),
      ]);
      const body = await marked.parse(md || '');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; padding: 44px 40px; color: #18181b; line-height: 1.6; font-size: 15px; }
  h1 { font-size: 26px; margin: 0 0 20px; color: #0a0a0f; }
  h2 { font-size: 20px; margin: 28px 0 10px; color: #0a0a0f; }
  h3 { font-size: 17px; margin: 22px 0 8px; color: #0a0a0f; }
  code { background: #f4f4f5; padding: 2px 5px; border-radius: 4px; font-size: 90%; }
  pre { background: #f4f4f5; padding: 14px; border-radius: 8px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #e4e4e7; padding: 8px 10px; text-align: left; }
  th { background: #fafafa; }
  blockquote { border-left: 3px solid #7c3aed; margin: 12px 0; padding: 2px 0 2px 16px; color: #52525b; }
  a { color: #7c3aed; }
  ul, ol { padding-left: 22px; }
</style></head>
<body><h1>${escapeHtml(t || 'Document')}</h1>${body}</body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf', dialogTitle: t });
      } else {
        share(t, md);
      }
    } catch {
      // expo-print/expo-sharing not in this binary — degrade to plaintext share
      share(t, md);
    } finally {
      setExporting(false);
    }
  }

  const dirty = draftTitle !== title || draftMd !== markdown;

  return (
    <View className="border border-border rounded-2xl overflow-hidden bg-surface self-start" style={{ maxWidth: 320 }}>
      <View className="px-4 py-3 flex-row items-center gap-2.5 border-b border-border">
        <View className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 items-center justify-center">
          <Icon name="description" size={16} color={c.brand} />
        </View>
        <Text className="text-text text-sm font-semibold flex-1" numberOfLines={1}>{title}</Text>
      </View>

      <TouchableOpacity onPress={openEditor} activeOpacity={0.7} className="px-4 py-3" style={{ maxHeight: 260, overflow: 'hidden' }}>
        <Markdown text={markdown} />
      </TouchableOpacity>

      <View className="px-4 py-2.5 border-t border-border flex-row items-center gap-4">
        <TouchableOpacity onPress={openEditor} activeOpacity={0.7} className="flex-row items-center gap-1.5">
          <Icon name="edit" size={14} color={c.brand} />
          <Text className="text-brand text-xs font-semibold">Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => share(title, markdown)} activeOpacity={0.7} className="flex-row items-center gap-1.5">
          <Icon name="ios-share" size={14} color={c.muted} />
          <Text className="text-muted text-xs">Share</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => exportPdf(title, markdown)} disabled={exporting} activeOpacity={0.7} className="flex-row items-center gap-1.5">
          <Icon name="picture-as-pdf" size={14} color={c.muted} />
          <Text className="text-muted text-xs">{exporting ? 'Exporting…' : 'PDF'}</Text>
        </TouchableOpacity>
      </View>

      {/* Full-screen editor workspace */}
      <Modal visible={editing} animationType="slide" onRequestClose={() => setEditing(false)}>
        <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
          <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Header */}
            <View className="px-4 py-3 flex-row items-center gap-2 border-b border-border">
              <TextInput
                value={draftTitle}
                onChangeText={setDraftTitle}
                placeholder="Document title"
                placeholderTextColor={c.muted}
                className="flex-1 text-text text-base font-semibold"
              />
              <TouchableOpacity onPress={() => exportPdf(draftTitle, draftMd)} disabled={exporting} hitSlop={8} activeOpacity={0.7}>
                <Icon name="picture-as-pdf" size={20} color={c.muted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => share(draftTitle, draftMd)} hitSlop={8} activeOpacity={0.7}>
                <Icon name="ios-share" size={20} color={c.muted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditing(false)} hitSlop={8} activeOpacity={0.7}>
                <Icon name="close" size={22} color={c.muted} />
              </TouchableOpacity>
            </View>

            {/* Edit / Preview toggle */}
            <View className="flex-row gap-2 px-4 py-2">
              {(['edit', 'preview'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMode(m)}
                  activeOpacity={0.7}
                  className={`px-3 py-1.5 rounded-full border ${mode === m ? 'bg-brand/10 border-brand/40' : 'border-border'}`}
                >
                  <Text className={`text-xs font-medium ${mode === m ? 'text-brand' : 'text-muted'}`}>
                    {m === 'edit' ? 'Edit' : 'Preview'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Body */}
            {mode === 'edit' ? (
              <TextInput
                value={draftMd}
                onChangeText={setDraftMd}
                multiline
                textAlignVertical="top"
                placeholder="Write in markdown…"
                placeholderTextColor={c.muted}
                className="flex-1 text-text text-sm px-4 py-3"
                style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
              />
            ) : (
              <ScrollView className="flex-1 px-4 py-3" contentContainerStyle={{ paddingBottom: 24 }}>
                <Markdown text={draftMd} />
              </ScrollView>
            )}

            {/* Footer */}
            <View className="px-4 py-3 border-t border-border flex-row justify-end">
              <TouchableOpacity
                onPress={saveEdits}
                disabled={!dirty || saving}
                activeOpacity={0.8}
                className={`px-5 py-2.5 rounded-xl bg-brand ${!dirty || saving ? 'opacity-40' : ''}`}
              >
                <Text className="text-white text-sm font-semibold">{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
