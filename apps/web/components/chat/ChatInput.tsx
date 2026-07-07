'use client';

import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react';
import Link from 'next/link';
import { Tooltip } from '@/components/ui/Tooltip';
import { auth } from '@/lib/firebase';
import ModelSwitcher from '@/components/chat/ModelSwitcher';

interface ConnectedServices {
  google: boolean; notion: boolean; slack: boolean; github: boolean; contacts: boolean;
}

interface Props {
  input: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onVoiceTranscript: (text: string) => void;
  onImageAttach: (base64: string, mimeType: string) => void;
  isLoading: boolean;
  attachedImage: string | null;
  onClearImage: () => void;
  attachedFiles?: { name: string; text: string }[];
  onFileAttach?: (name: string, text: string) => void;
  onRemoveFile?: (index: number) => void;
  webSearchOn?: boolean;
  onToggleWebSearch?: () => void;
  connectedServices?: ConnectedServices | null;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  /** When set (signed-in users), shows the model switcher. */
  plan?: string;
  modelChoice?: string;
  onModelChange?: (value: string) => void;
}

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|log|ya?ml|xml|tsx?|jsx?|py|rb|go|rs|java|kt|swift|c|cc|cpp|h|hpp|cs|php|css|scss|html?|sh|bash|zsh|sql|toml|ini|env)$/i;
const MAX_CHARS = 24000;

export default function ChatInput({
  input, onChange, onSubmit, onVoiceTranscript, onImageAttach, isLoading,
  attachedImage, onClearImage, attachedFiles = [], onFileAttach, onRemoveFile,
  webSearchOn = false, onToggleWebSearch, connectedServices, textareaRef, plan, modelChoice, onModelChange,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [attachError, setAttachError] = useState('');
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const imageRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.closest('form')?.requestSubmit();
    }
  }

  async function toggleRecording() {
    if (recording) { mediaRef.current?.stop(); setRecording(false); return; }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setVoiceError('Microphone access denied.');
      setTimeout(() => setVoiceError(''), 3000);
      return;
    }
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = e => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const form = new FormData();
      form.append('audio', blob);
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
        body: form,
      });
      const data = await res.json() as { text?: string };
      if (data.text) onVoiceTranscript(data.text);
    };
    recorder.start();
    mediaRef.current = recorder;
    setRecording(true);
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, base64] = result.split(',');
      const mimeType = header.match(/data:(.*);/)?.[1] || 'image/jpeg';
      onImageAttach(base64, mimeType);
    };
    reader.readAsDataURL(file);
  }

  async function handleDocChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onFileAttach) return;
    setAttachError('');
    setExtracting(file.name);
    try {
      const isText = file.type.startsWith('text/') || TEXT_EXT.test(file.name);
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      const isDocx = /\.docx$/i.test(file.name) || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      let text = '';
      if (isText && !isDocx) {
        text = (await file.text()).slice(0, MAX_CHARS);
        if (!text.trim()) throw new Error('That file looks empty.');
      } else if (isPdf || isDocx) {
        const token = await auth.currentUser?.getIdToken();
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/attachments/extract', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not read that file.');
        text = data.text as string;
      } else {
        throw new Error('Unsupported file. Try a PDF, Word, text, or CSV file.');
      }
      onFileAttach(file.name, text);
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'Could not read that file.');
      setTimeout(() => setAttachError(''), 4000);
    } finally {
      setExtracting(null);
    }
  }

  const services: { key: keyof ConnectedServices; label: string }[] = [
    { key: 'google', label: 'Google' }, { key: 'notion', label: 'Notion' },
    { key: 'slack', label: 'Slack' }, { key: 'github', label: 'GitHub' }, { key: 'contacts', label: 'Contacts' },
  ];

  return (
    <form onSubmit={onSubmit} className="border-t border-border">
      <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
      <input ref={docRef} type="file" accept=".pdf,.docx,.txt,.md,.markdown,.csv,.tsv,.json,.log,.yaml,.yml,.xml,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={handleDocChange} />

      <div className="max-w-6xl mx-auto px-8 py-4">
        {/* Attachment chips */}
        {(attachedImage || attachedFiles.length > 0 || extracting) && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachedImage && (
              <div className="relative inline-block">
                <img src={`data:image/jpeg;base64,${attachedImage}`} alt="attachment" className="h-16 w-16 object-cover rounded-lg border border-border" />
                <button type="button" onClick={onClearImage} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-border rounded-full text-muted text-xs flex items-center justify-center hover:text-text">×</button>
              </div>
            )}
            {attachedFiles.map((f, i) => (
              <span key={i} className="flex items-center gap-2 bg-panel border border-border rounded-lg pl-2 pr-1.5 py-1.5 max-w-[220px]">
                <FileIcon />
                <span className="text-xs text-text truncate">{f.name}</span>
                <button type="button" onClick={() => onRemoveFile?.(i)} className="text-muted hover:text-text shrink-0" aria-label="Remove file">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="w-3 h-3"><path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </span>
            ))}
            {extracting && (
              <span className="flex items-center gap-2 bg-panel border border-border rounded-lg px-2.5 py-1.5">
                <span className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-muted truncate max-w-[160px]">Reading {extracting}…</span>
              </span>
            )}
          </div>
        )}

        <div className="flex gap-3 items-end bg-panel border border-border rounded-2xl px-4 py-3">
          {/* "+" menu */}
          <div className="relative shrink-0" ref={menuRef}>
            <Tooltip label="Attach & tools" side="top">
              <button
                type="button"
                onClick={() => setMenuOpen(o => !o)}
                className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${menuOpen ? 'bg-brand/10 border-brand/40 text-brand' : 'border-border text-muted hover:text-text hover:border-brand/40'}`}
                aria-label="Attach and tools"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </Tooltip>

            {menuOpen && (
              <div className="absolute bottom-full mb-2 left-0 w-64 bg-panel border border-border rounded-xl shadow-2xl p-1.5 z-50">
                <MenuItem onClick={() => { setMenuOpen(false); imageRef.current?.click(); }} icon={<PhotoIcon />} label="Attach photo" hint="PNG, JPG" />
                <MenuItem onClick={() => { setMenuOpen(false); docRef.current?.click(); }} icon={<FileIcon />} label="Attach file" hint="PDF, Word, text" />
                <div className="my-1 border-t border-border/60" />
                <button
                  type="button"
                  onClick={() => onToggleWebSearch?.()}
                  className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-text hover:bg-bg transition-colors"
                >
                  <span className={webSearchOn ? 'text-brand' : 'text-muted'}><SearchIcon /></span>
                  <span className="flex-1 text-left">Web search</span>
                  <span className={`w-8 rounded-full relative transition-colors ${webSearchOn ? 'bg-brand' : 'bg-border'}`} style={{ height: 18 }}>
                    <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${webSearchOn ? 'left-[15px]' : 'left-0.5'}`} />
                  </span>
                </button>
                <div className="my-1 border-t border-border/60" />
                <div className="px-2.5 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Connected</div>
                {connectedServices ? (
                  <div className="px-2.5 pb-1 flex flex-wrap gap-x-3 gap-y-1">
                    {services.map(s => (
                      <span key={s.key} className="flex items-center gap-1.5 text-xs">
                        <span className={`w-1.5 h-1.5 rounded-full ${connectedServices[s.key] ? 'bg-green-400' : 'bg-border'}`} />
                        <span className={connectedServices[s.key] ? 'text-text' : 'text-muted'}>{s.label}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="px-2.5 pb-1 text-xs text-muted">Loading…</div>
                )}
                <Link href="/capabilities" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-muted hover:text-text hover:bg-bg transition-colors">
                  <PlugIcon />
                  <span className="flex-1 text-left">Manage connections</span>
                  <span>→</span>
                </Link>
              </div>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            placeholder="Talk to MODUS..."
            rows={1}
            className="flex-1 bg-transparent text-text text-sm placeholder-muted outline-none resize-none max-h-36"
          />

          {webSearchOn && (
            <button type="button" onClick={() => onToggleWebSearch?.()} className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-brand bg-brand/10 border border-brand/25 rounded-full pl-2 pr-1.5 py-1" title="Web search on — click to turn off">
              <SearchIcon className="w-3 h-3" />
              Search
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="w-2.5 h-2.5"><path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          )}

          <Tooltip label={recording ? 'Stop recording' : 'Voice input'} side="top" className="shrink-0">
            <button
              type="button"
              onClick={toggleRecording}
              className={`shrink-0 transition-colors pb-0.5 ${recording ? 'text-red-400 animate-pulse' : 'text-muted hover:text-text'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            </button>
          </Tooltip>

          <Tooltip label="Send" side="top" className="shrink-0">
            <button
              type="submit"
              disabled={isLoading || (!input.trim() && !attachedImage && attachedFiles.length === 0)}
              className="shrink-0 w-8 h-8 rounded-lg bg-brand flex items-center justify-center disabled:opacity-30 transition-opacity hover:bg-brand/90"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
              </svg>
            </button>
          </Tooltip>
        </div>

        {(voiceError || attachError) && <p className="text-center text-red-400 text-xs mt-1">{voiceError || attachError}</p>}
        <div className="flex items-center justify-between gap-3 mt-2">
          {plan && onModelChange ? (
            <ModelSwitcher value={modelChoice ?? 'auto'} onChange={onModelChange} plan={plan} />
          ) : <span />}
          <p className="text-muted text-xs">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </form>
  );
}

function MenuItem({ onClick, icon, label, hint }: { onClick: () => void; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-text hover:bg-bg transition-colors">
      <span className="text-muted">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {hint && <span className="text-[10px] text-muted/70">{hint}</span>}
    </button>
  );
}

function PhotoIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>;
}
function FileIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>;
}
function SearchIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>;
}
function PlugIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
}
