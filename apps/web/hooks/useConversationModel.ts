'use client';
import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { accountModelChoice, resolveModelChoice } from '@/lib/model-choice';
import type { ModelConfig } from '@/hooks/useUserSettings';

export function useConversationModel(uid: string | undefined, conversationId: string, savedChoice: string | undefined, config: ModelConfig | undefined, plan: string) {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [modelError, setModelError] = useState('');
  const modelChoice = resolveModelChoice(choices[conversationId] ?? savedChoice ?? accountModelChoice(config, plan), plan);
  async function handleModelChange(value: string) {
    const choice = resolveModelChoice(value, plan);
    setChoices(prev => ({ ...prev, [conversationId]: choice }));
    setModelError('');
    if (!uid) return;
    try { await setDoc(doc(db, 'users', uid, 'conversations', conversationId), { modelChoice: choice }, { merge: true }); }
    catch { setModelError('Could not save the model choice. Select it again to retry.'); }
  }
  return { modelChoice, handleModelChange, modelError };
}
