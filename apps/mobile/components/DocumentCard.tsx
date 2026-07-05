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
// persisted to Firestore. One-click PDF export is web-only; here we use native
// Share (Files / Notes / Messages).
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
