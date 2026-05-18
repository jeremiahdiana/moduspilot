'use client';

import { useState, useRef, type FormEvent, type ChangeEvent } from 'react';

interface Props {
  input: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onVoiceTranscript: (text: string) => void;
  onImageAttach: (base64: string, mimeType: string) => void;
  isLoading: boolean;
  attachedImage: string | null;
  onClearImage: () => void;
}

export default function ChatInput({ input, onChange, onSubmit, onVoiceTranscript, onImageAttach, isLoading, attachedImage, onClearImage }: Props) {
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.closest('form');
      form?.requestSubmit();
    }
  }

  async function toggleRecording() {
    if (recording) {
      mediaRef.current?.stop();
      setRecording(false);
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = e => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const form = new FormData();
      form.append('audio', blob);
      const res = await fetch('/api/transcribe', { method: 'POST', body: form });
      const data = await res.json() as { text?: string };
      if (data.text) onVoiceTranscript(data.text);
    };
    recorder.start();
    mediaRef.current = recorder;
    setRecording(true);
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, base64] = result.split(',');
      const mimeType = header.match(/data:(.*);/)?.[1] || 'image/jpeg';
      onImageAttach(base64, mimeType);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <form onSubmit={onSubmit} className="px-8 py-4 border-t border-border">
      {attachedImage && (
        <div className="mb-2 relative inline-block">
          <img src={`data:image/jpeg;base64,${attachedImage}`} alt="attachment" className="h-16 w-16 object-cover rounded-lg border border-border" />
          <button type="button" onClick={onClearImage} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-border rounded-full text-muted text-xs flex items-center justify-center hover:text-text">×</button>
        </div>
      )}
      <div className="flex gap-3 items-end bg-panel border border-border rounded-2xl px-4 py-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="shrink-0 text-muted hover:text-text transition-colors pb-0.5"
          title="Attach image"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />

        <textarea
          value={input}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder="Talk to MODUS..."
          rows={1}
          className="flex-1 bg-transparent text-text text-sm placeholder-muted outline-none resize-none max-h-36"
        />

        <button
          type="button"
          onClick={toggleRecording}
          className={`shrink-0 transition-colors pb-0.5 ${recording ? 'text-red-400 animate-pulse' : 'text-muted hover:text-text'}`}
          title={recording ? 'Stop recording' : 'Voice input'}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
          </svg>
        </button>

        <button
          type="submit"
          disabled={isLoading || (!input.trim() && !attachedImage)}
          className="shrink-0 w-8 h-8 rounded-lg bg-brand flex items-center justify-center disabled:opacity-30 transition-opacity hover:bg-brand/90"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
          </svg>
        </button>
      </div>
      <p className="text-center text-muted text-xs mt-2">Enter to send · Shift+Enter for new line</p>
    </form>
  );
}
