import { useCallback, useState } from 'react';
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { API_BASE, getAuthHeader } from '@/lib/api';

type VoiceState = 'idle' | 'recording' | 'transcribing';

/**
 * Voice input — record mic audio with expo-audio, then transcribe via the same
 * /api/transcribe (Groq Whisper) endpoint the web app uses. Returns a toggle:
 * first press starts recording, second stops + transcribes and calls onResult.
 *
 * Requires the expo-audio native module (a dev rebuild — `npx expo run:ios`).
 */
export function useVoiceInput(onResult: (text: string) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState('');

  const start = useCallback(async () => {
    setError('');
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setError('Microphone access denied.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setState('recording');
  }, [recorder]);

  const stop = useCallback(async () => {
    setState('transcribing');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) { setState('idle'); return; }

      const form = new FormData();
      // RN FormData accepts a file descriptor object for multipart uploads.
      form.append('audio', { uri, name: 'audio.m4a', type: 'audio/m4a' } as unknown as Blob);

      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/api/transcribe`, { method: 'POST', headers, body: form });
      const data = (await res.json()) as { text?: string; error?: string };
      if (data.text?.trim()) onResult(data.text.trim());
      else setError('Could not transcribe that. Try again.');
    } catch {
      setError('Transcription failed. Try again.');
    } finally {
      setState('idle');
    }
  }, [recorder, onResult]);

  const toggle = useCallback(() => {
    if (state === 'transcribing') return;
    if (state === 'recording') void stop();
    else void start();
  }, [state, start, stop]);

  return { state, error, toggle };
}
