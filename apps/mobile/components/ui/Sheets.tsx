import { createContext, useCallback, useContext, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput, Pressable,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useThemeColors } from '@/lib/theme';
import { haptics } from '@/lib/haptics';

/**
 * In-app sheets that replace the native iOS Alert. One imperative API
 * (`useSheets()`) mirroring Alert so call sites convert cleanly:
 *   const { actionSheet, prompt, confirm } = useSheets();
 *   actionSheet({ title, actions: [{ label, onPress, destructive }] });
 *   const name = await prompt({ title, defaultValue });   // string | null
 *   const ok   = await confirm({ title, destructive });   // boolean
 * Styled to the refined-brand system (flat surface, hairline borders).
 */

type ActionItem = { label: string; destructive?: boolean; onPress?: () => void };
type ActionSheetOpts = { title?: string; message?: string; actions: ActionItem[]; cancelLabel?: string };
type PromptOpts = { title: string; message?: string; placeholder?: string; defaultValue?: string; confirmLabel?: string; multiline?: boolean };
type ConfirmOpts = { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean };

type Sheet =
  | { kind: 'action'; opts: ActionSheetOpts }
  | { kind: 'prompt'; opts: PromptOpts; resolve: (v: string | null) => void }
  | { kind: 'confirm'; opts: ConfirmOpts; resolve: (v: boolean) => void };

const Ctx = createContext<{
  actionSheet: (o: ActionSheetOpts) => void;
  prompt: (o: PromptOpts) => Promise<string | null>;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
}>({ actionSheet: () => {}, prompt: async () => null, confirm: async () => false });

export const useSheets = () => useContext(Ctx);

export function SheetsProvider({ children }: { children: React.ReactNode }) {
  const c = useThemeColors();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [text, setText] = useState('');

  const actionSheet = useCallback((opts: ActionSheetOpts) => { haptics.light(); setSheet({ kind: 'action', opts }); }, []);
  const prompt = useCallback((opts: PromptOpts) => {
    setText(opts.defaultValue ?? '');
    return new Promise<string | null>(resolve => setSheet({ kind: 'prompt', opts, resolve }));
  }, []);
  const confirm = useCallback((opts: ConfirmOpts) => {
    haptics.light();
    return new Promise<boolean>(resolve => setSheet({ kind: 'confirm', opts, resolve }));
  }, []);

  function dismiss() {
    if (sheet?.kind === 'prompt') sheet.resolve(null);
    if (sheet?.kind === 'confirm') sheet.resolve(false);
    setSheet(null);
  }

  const centered = sheet?.kind === 'prompt';

  return (
    <Ctx.Provider value={{ actionSheet, prompt, confirm }}>
      {children}
      <Modal visible={!!sheet} transparent animationType="fade" onRequestClose={dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Pressable onPress={dismiss} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: centered ? 'center' : 'flex-end', padding: 16 }}>
            <Pressable onPress={() => {}} style={{ width: '100%' }}>
              {sheet?.kind === 'action' && (
                <View className="bg-surface border border-border rounded-2xl overflow-hidden">
                  {(sheet.opts.title || sheet.opts.message) && (
                    <View className="px-5 pt-4 pb-3 border-b border-border">
                      {sheet.opts.title ? <Text className="text-text font-display font-bold text-base text-center">{sheet.opts.title}</Text> : null}
                      {sheet.opts.message ? <Text className="text-muted text-sm text-center mt-1">{sheet.opts.message}</Text> : null}
                    </View>
                  )}
                  {sheet.opts.actions.map((a, i) => (
                    <TouchableOpacity
                      key={i}
                      activeOpacity={0.7}
                      onPress={() => { setSheet(null); a.onPress?.(); }}
                      className={`px-5 py-4 items-center ${i > 0 ? 'border-t border-border' : ''}`}
                    >
                      <Text className={`text-base font-semibold ${a.destructive ? 'text-red-500' : 'text-text'}`}>{a.label}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity activeOpacity={0.7} onPress={dismiss} className="px-5 py-4 items-center border-t border-border">
                    <Text className="text-muted text-base font-medium">{sheet.opts.cancelLabel ?? 'Cancel'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {sheet?.kind === 'confirm' && (
                <View className="bg-surface border border-border rounded-2xl overflow-hidden">
                  <View className="px-5 pt-4 pb-3">
                    <Text className="text-text font-display font-bold text-base text-center">{sheet.opts.title}</Text>
                    {sheet.opts.message ? <Text className="text-muted text-sm text-center mt-1.5 leading-5">{sheet.opts.message}</Text> : null}
                  </View>
                  <View className="flex-row border-t border-border">
                    <TouchableOpacity activeOpacity={0.7} onPress={() => { sheet.resolve(false); setSheet(null); }} className="flex-1 px-5 py-4 items-center border-r border-border">
                      <Text className="text-muted text-base font-medium">{sheet.opts.cancelLabel ?? 'Cancel'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => { sheet.resolve(true); setSheet(null); }} className="flex-1 px-5 py-4 items-center">
                      <Text className={`text-base font-bold ${sheet.opts.destructive ? 'text-red-500' : 'text-brand'}`}>{sheet.opts.confirmLabel ?? 'Confirm'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {sheet?.kind === 'prompt' && (
                <View className="bg-surface border border-border rounded-2xl overflow-hidden">
                  <View className="px-5 pt-4 pb-3">
                    <Text className="text-text font-display font-bold text-base">{sheet.opts.title}</Text>
                    {sheet.opts.message ? <Text className="text-muted text-sm mt-1 leading-5">{sheet.opts.message}</Text> : null}
                    <TextInput
                      autoFocus
                      value={text}
                      onChangeText={setText}
                      placeholder={sheet.opts.placeholder}
                      placeholderTextColor={c.muted}
                      multiline={sheet.opts.multiline}
                      className="mt-3 bg-bg border border-border rounded-xl px-3.5 py-3 text-text text-[15px]"
                      style={{ minHeight: sheet.opts.multiline ? 80 : undefined }}
                    />
                  </View>
                  <View className="flex-row border-t border-border">
                    <TouchableOpacity activeOpacity={0.7} onPress={() => { sheet.resolve(null); setSheet(null); }} className="flex-1 px-5 py-4 items-center border-r border-border">
                      <Text className="text-muted text-base font-medium">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => { const v = text; sheet.resolve(v); setSheet(null); }} className="flex-1 px-5 py-4 items-center">
                      <Text className="text-brand text-base font-bold">{sheet.opts.confirmLabel ?? 'Save'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </Ctx.Provider>
  );
}
