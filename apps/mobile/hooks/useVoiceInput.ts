import { useCallback, useState } from 'react';
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { API_BASE, getAuthHeader } from '@/lib/api';

type VoiceState = 'idle' | 'recording' | 'transcribing';

/**
 * Voice input — record mic audio with expo-audio, then transcribe via the same
 * /api/transcribe (Groq Whisper) endpoint the web app uses. Returns a toggle:
 * first press starts recording, second stops + transcribes and calls onResult.
 *
 * The upload uses expo-file-system's native multipart uploadAsync rather than
 * fetch + FormData: the app's global fetch is Expo's WinterCG implementation
 * (required for the streaming chat response), which rejects React Native's
 * `{ uri, name, type }` file-part shortcut ("unsupported FormData part").
 * uploadAsync streams the file natively and sidesteps that entirely.
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
      if (!uri) { setError('No recording captured. Try again.'); setState('idle'); return; }

      const headers = await getAuthHeader();
      const res = await uploadAsync(`${API_BASE}/api/transcribe`, uri, {
        httpMethod: 'POST',
        uploadType: FileSystemUploadType.MULTIPART,
        fieldName: 'audio',
        mimeType: 'audio/m4a',
        headers,
      });

      if (res.status < 200 || res.status >= 300) {
        setError('Could not transcribe that. Try again.');
        return;
      }
      const data = JSON.parse(res.body) as { text?: string; error?: string };
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
