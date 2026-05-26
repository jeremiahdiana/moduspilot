'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  doc, onSnapshot, updateDoc, collection, query, where,
  addDoc, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useChat } from 'ai/react';
import type { Message } from 'ai';
import MessageBubble from '@/components/chat/MessageBubble';
import { motion, AnimatePresence } from 'framer-motion';

type ProjectTab = 'resources' | 'tasks' | 'notes';
type NoteType = 'win' | 'blocker' | 'idea' | 'reflection';
type ResourceType = 'github' | 'notion' | 'slack' | 'drive' | 'url';

interface PinnedResource {
  type: ResourceType;
  name: string;
  url?: string;
  repo?: string;
  pageId?: string;
  channelId?: string;
  fileId?: string;
}

interface Note { id: string; content: string; date: string; type?: NoteType; pinned?: boolean; }
interface ProjectTask { id: string; title: string; done: boolean; }

interface Project {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'archived';
  resources: PinnedResource[];
  notes: Note[];
}

interface ProjectChat { id: string; title: string; messages: Message[]; createdAt: Date; }

const NOTE_TYPES: Record<NoteType, { label: string; color: string; bg: string; border: string }> = {
  win:        { label: 'Win',        color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  blocker:    { label: 'Blocker',    color: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/30'     },
  idea:       { label: 'Idea',       color: 'text-amber-500',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30'   },
  reflection: { label: 'Reflection', color: 'text-brand',       bg: 'bg-brand/10',       border: 'border-brand/30'       },
};

const RESOURCE_TYPES: { type: ResourceType; label: string; d: string }[] = [
  { type: 'github', label: 'GitHub',  d: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22' },
  { type: 'notion', label: 'Notion',  d: 'M4 4h16v16H4z' },
  { type: 'slack',  label: 'Slack',   d: 'M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z' },
  { type: 'drive',  label: 'Drive',   d: 'M22 16.74L17.74 9H6.26L2 16.74V17l3.06 5.17a1 1 0 00.87.5h12.14a1 1 0 00.87-.5L22 17v-.26zM12 3L7.74 9h8.52L12 3z' },
  { type: 'url',    label: 'URL',     d: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71' },
];

function sanitizeMessages(msgs: Message[]): { id: string; role: string; content: string }[] {
  return msgs.map(m => ({
    id: m.id,
    role: m.role,
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
  }));
}

interface AvailableResource {
  id: string;
  name: string;
  sub?: string;
  url?: string;
  repo?: string;
  pageId?: string;
  channelId?: string;
  fileId?: string;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { settings } = useUserSettings(user);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>('resources');

  // Tasks
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const taskInputRef = useRef<HTMLInputElement>(null);

  // Notes
  const [newNoteContent, setNewNoteContent] = useState('');
  const [selectedNoteType, setSelectedNoteType] = useState<NoteType | undefined>(undefined);
  const [noteFilter, setNoteFilter] = useState<'all' | NoteType>('all');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const editNoteRef = useRef<HTMLTextAreaElement>(null);

  // Resource picker
  const [showPicker, setShowPicker] = useState(false);
  const [pickerType, setPickerType] = useState<ResourceType | null>(null);
  const [availableResources, setAvailableResources] = useState<AvailableResource[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [urlDraft, setUrlDraft] = useState({ name: '', url: '' });

  // Multi-chat
  const [allChats, setAllChats] = useState<ProjectChat[]>([]);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const activeChatIdRef = useRef(`project-${id}`);
  const [activeChatId, _setActiveChatId] = useState(`project-${id}`);
  const setActiveChatId = (newId: string) => { activeChatIdRef.current = newId; _setActiveChatId(newId); };
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const pendingMsgRef   = useRef<string | null>(null);
  const savedLengthRef  = useRef(0);
  const prevLoadingRef  = useRef(false);
  const seededRef       = useRef(false);
  const bottomRef       = useRef<HTMLDivElement>(null);

  // ── Auth token ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async u => {
      setAuthToken(u ? await u.getIdToken() : null);
    });
    return unsub;
  }, []);

  // ── Load project ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !id) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid, 'projects', id), snap => {
      if (!snap.exists()) { router.replace('/projects'); return; }
      const d = snap.data();
      setProject({
        id: snap.id,
        title: d.title ?? 'Untitled',
        description: d.description,
        status: d.status ?? 'active',
        resources: (d.resources as PinnedResource[]) ?? [],
        notes: (d.notes as Note[]) ?? [],
      });
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user, id, router]);

  // ── Load tasks ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !id) return;
    const q = query(collection(db, 'users', user.uid, 'tasks'), where('projectId', '==', id));
    const unsub = onSnapshot(q, snap => {
      setProjectTasks(
        snap.docs
          .filter(d => !d.data().deleted)
          .map(d => ({ id: d.id, title: d.data().title ?? '', done: d.data().done ?? false }))
          .sort((a, b) => Number(a.done) - Number(b.done))
      );
    });
    return unsub;
  }, [user, id]);

  // ── Load chats ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !id) return;
    const unsub = onSnapshot(
      query(collection(db, 'users', user.uid, 'conversations'), where('projectId', '==', id)),
      snap => {
        const chats: ProjectChat[] = snap.docs
          .filter(d => !d.data().deleted)
          .map(d => ({
            id: d.id,
            title: d.data().title ?? 'Chat',
            messages: (d.data().messages as Message[]) ?? [],
            createdAt: d.data().createdAt?.toDate() ?? new Date(),
          }))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        setAllChats(chats);
        setChatsLoaded(true);
      },
      () => setChatsLoaded(true),
    );
    return unsub;
  }, [user, id]);

  // ── Auto-focus ────────────────────────────────────────────────────────────────
  useEffect(() => { if (addingTask) taskInputRef.current?.focus(); }, [addingTask]);
  useEffect(() => { if (editingNoteId) editNoteRef.current?.focus(); }, [editingNoteId]);
  useEffect(() => {
    if (renamingChatId) setTimeout(() => { renameInputRef.current?.focus(); renameInputRef.current?.select(); }, 10);
  }, [renamingChatId]);

  // ── Save conversation ─────────────────────────────────────────────────────────
  const saveConversation = useCallback(async (msgs: Message[]) => {
    if (!user || !id) return;
    const chatId = activeChatIdRef.current;
    const isMain = chatId === `project-${id}`;
    try {
      await setDoc(doc(db, 'users', user.uid, 'conversations', chatId), {
        projectId: id,
        ...(isMain ? { title: `Project: ${project?.title ?? 'Untitled'}` } : {}),
        messages: sanitizeMessages(msgs),
        updatedAt: new Date(),
        deleted: false,
      }, { merge: true });
    } catch (e) { console.error('[project chat] save failed:', e); }
  }, [user, id, project]);

  const { messages, input, handleInputChange, append, isLoading, setInput, setMessages } = useChat({
    api: '/api/chat',
    initialMessages: [],
    id: `project-${id}`,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    body: {
      personalContext: settings.personalContext ?? '',
      responseStyle: settings.responseStyle ?? 'normal',
      customStyle: settings.customStyle ?? '',
      projectContext: project
        ? { id: project.id, title: project.title, description: project.description, resources: project.resources, activeChatId }
        : undefined,
    },
  });

  // Seed initial message
  useEffect(() => {
    if (!chatsLoaded || seededRef.current || !project) return;
    seededRef.current = true;
    const main = allChats.find(c => c.id === `project-${id}`);
    const seedMsg = project.resources.length > 0
      ? `Welcome back to "${project.title}". I have context on ${project.resources.length} pinned resource${project.resources.length !== 1 ? 's' : ''}. What would you like to work on?`
      : `"${project.title}" is ready. Pin resources in the Resources tab to scope my context to this project specifically.`;
    const msgs: Message[] = main?.messages.length
      ? main.messages
      : [{ id: `project-seed-${id}`, role: 'assistant' as const, content: seedMsg }];
    setMessages(msgs);
    savedLengthRef.current = msgs.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatsLoaded, project]);

  useEffect(() => {
    if (!pendingMsgRef.current || isLoading) return;
    const msg = pendingMsgRef.current;
    pendingMsgRef.current = null;
    append({ role: 'user', content: msg });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    const justFinished = prevLoadingRef.current && !isLoading;
    prevLoadingRef.current = isLoading;
    if (!justFinished || messages.length === 0 || messages.length <= savedLengthRef.current) return;
    savedLengthRef.current = messages.length;
    saveConversation(messages);
  }, [isLoading, messages, saveConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Chat helpers ──────────────────────────────────────────────────────────────
  const mainChatId = `project-${id}`;
  const extraChats = allChats.filter(c => c.id !== mainChatId);

  function switchChat(chat: ProjectChat) {
    setActiveChatId(chat.id);
    setMessages(chat.messages.length ? chat.messages : []);
    savedLengthRef.current = chat.messages.length;
  }

  async function deleteChat(chatId: string) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'conversations', chatId), { deleted: true });
    if (activeChatId === chatId) {
      const main = allChats.find(c => c.id === mainChatId);
      if (main) switchChat(main);
      else { setActiveChatId(mainChatId); setMessages([]); savedLengthRef.current = 0; }
    }
  }

  async function saveRenameChat(chatId: string, title: string) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'conversations', chatId), { title: title.trim() || 'New chat' });
    setRenamingChatId(null);
  }

  async function startNewChat() {
    if (!user) return;
    const ref = await addDoc(collection(db, 'users', user.uid, 'conversations'), {
      projectId: id, title: 'New chat', messages: [],
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), deleted: false,
    });
    setActiveChatId(ref.id);
    setMessages([]);
    savedLengthRef.current = 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const val = input.trim();
    setInput('');
    await append({ role: 'user', content: val });
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────────
  async function addTask() {
    if (!user || !newTaskTitle.trim()) return;
    await addDoc(collection(db, 'users', user.uid, 'tasks'), {
      title: newTaskTitle.trim(), done: false, projectId: id, priority: 'medium',
      createdAt: serverTimestamp(), deleted: false,
    });
    setNewTaskTitle('');
    setAddingTask(false);
  }

  async function toggleTask(taskId: string, done: boolean) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'tasks', taskId), { done: !done });
  }

  async function deleteTask(taskId: string) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'tasks', taskId), { deleted: true });
  }

  // ── Notes ─────────────────────────────────────────────────────────────────────
  async function addNote() {
    if (!user || !project || !newNoteContent.trim()) return;
    const note: Note = { id: crypto.randomUUID(), content: newNoteContent.trim(), date: new Date().toISOString().slice(0, 10), type: selectedNoteType, pinned: false };
    await updateDoc(doc(db, 'users', user.uid, 'projects', id), { notes: [note, ...project.notes] });
    setNewNoteContent('');
    setSelectedNoteType(undefined);
  }

  async function updateNote(noteId: string) {
    if (!user || !project) return;
    const updated = project.notes.map(n => n.id === noteId ? { ...n, content: editDraft } : n);
    await updateDoc(doc(db, 'users', user.uid, 'projects', id), { notes: updated });
    setEditingNoteId(null);
  }

  async function deleteNote(noteId: string) {
    if (!user || !project) return;
    await updateDoc(doc(db, 'users', user.uid, 'projects', id), { notes: project.notes.filter(n => n.id !== noteId) });
  }

  async function togglePinNote(noteId: string) {
    if (!user || !project) return;
    const updated = project.notes.map(n => n.id === noteId ? { ...n, pinned: !n.pinned } : n);
    await updateDoc(doc(db, 'users', user.uid, 'projects', id), { notes: updated });
  }

  // ── Resources ─────────────────────────────────────────────────────────────────
  async function loadPickerResources(type: ResourceType) {
    if (type === 'url') { setAvailableResources([]); return; }
    setLoadingResources(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/projects/resources?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAvailableResources(data.items ?? []);
    } catch {
      setAvailableResources([]);
    } finally {
      setLoadingResources(false);
    }
  }

  async function pinResource(resource: PinnedResource) {
    if (!user || !project) return;
    const already = project.resources.some(r => r.name === resource.name && r.type === resource.type);
    if (already) return;
    await updateDoc(doc(db, 'users', user.uid, 'projects', id), { resources: [...project.resources, resource] });
    setShowPicker(false);
    setPickerType(null);
    setAvailableResources([]);
  }

  async function unpinResource(index: number) {
    if (!user || !project) return;
    const updated = project.resources.filter((_, i) => i !== index);
    await updateDoc(doc(db, 'users', user.uid, 'projects', id), { resources: updated });
  }

  async function pinUrl() {
    if (!urlDraft.name.trim() || !urlDraft.url.trim()) return;
    await pinResource({ type: 'url', name: urlDraft.name.trim(), url: urlDraft.url.trim() });
    setUrlDraft({ name: '', url: '' });
  }

  // ── Loading / not found ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) return null;

  const activeTasks = projectTasks.filter(t => !t.done);
  const doneTasks   = projectTasks.filter(t => t.done);
  const filteredNotes = noteFilter === 'all' ? project.notes : project.notes.filter(n => n.type === noteFilter);
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left column ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="p-6 md:p-8 max-w-2xl">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6"
          >
            <div className="flex items-start gap-3 mb-1">
              <button onClick={() => router.push('/projects')} className="mt-1 text-muted hover:text-text transition-colors shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-text">{project.title}</h1>
                  {project.status === 'archived' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-border text-muted">Archived</span>
                  )}
                </div>
                {project.description && <p className="text-sm text-muted mt-0.5">{project.description}</p>}
                <p className="text-[11px] text-muted mt-1">{project.resources.length} resource{project.resources.length !== 1 ? 's' : ''} pinned</p>
              </div>
            </div>
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-panel border border-border rounded-lg p-1 w-fit">
            {([
              { key: 'resources', label: 'Resources' },
              { key: 'tasks',     label: 'Tasks' },
              { key: 'notes',     label: 'Notes' },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === t.key ? 'bg-brand text-white' : 'text-muted hover:text-text'
                }`}
              >
                {t.label}
                {t.key === 'tasks' && activeTasks.length > 0 && (
                  <span className="ml-1.5 text-[10px] font-semibold bg-white/20 px-1.5 py-0.5 rounded-full">{activeTasks.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Resources Tab ──────────────────────────────────────────────────── */}
          {activeTab === 'resources' && (
            <div className="space-y-3">
              {project.resources.length === 0 && !showPicker && (
                <div className="text-center py-10 bg-panel border border-dashed border-border rounded-xl">
                  <p className="text-muted text-sm mb-1">No resources pinned yet.</p>
                  <p className="text-muted/60 text-xs mb-4">Pin repos, docs, channels, and files to scope MODUS's context to this project.</p>
                  <button
                    onClick={() => setShowPicker(true)}
                    className="text-sm text-brand hover:underline"
                  >
                    + Add your first resource
                  </button>
                </div>
              )}

              {/* Pinned resource list */}
              <div className="space-y-2">
                {project.resources.map((r, i) => {
                  const rt = RESOURCE_TYPES.find(t => t.type === r.type);
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.04 }}
                      className="flex items-center gap-3 bg-panel border border-border rounded-lg px-4 py-3 group"
                    >
                      <div className="w-7 h-7 rounded-md bg-bg border border-border flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-muted">
                          <path d={rt?.d ?? ''} />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-text hover:text-brand transition-colors truncate block" onClick={e => e.stopPropagation()}>
                            {r.name}
                          </a>
                        ) : (
                          <p className="text-sm font-medium text-text truncate">{r.name}</p>
                        )}
                        <p className="text-[11px] text-muted capitalize">{r.type}</p>
                      </div>
                      <button
                        onClick={() => unpinResource(i)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-red-400 p-1 rounded"
                        title="Unpin"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </motion.div>
                  );
                })}
              </div>

              {/* Add resource button */}
              {project.resources.length > 0 && !showPicker && (
                <button
                  onClick={() => setShowPicker(true)}
                  className="flex items-center gap-2 text-sm text-muted hover:text-brand transition-colors px-2 py-1 rounded-lg hover:bg-brand/5"
                >
                  <span className="text-base leading-none">+</span> Add resource
                </button>
              )}

              {/* Resource picker */}
              <AnimatePresence>
                {showPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2 }}
                    className="bg-panel border border-border rounded-xl p-4 space-y-4"
                  >
                    {/* Type selector */}
                    <div>
                      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Source</p>
                      <div className="flex gap-2 flex-wrap">
                        {RESOURCE_TYPES.map(rt => (
                          <button
                            key={rt.type}
                            onClick={() => {
                              setPickerType(rt.type);
                              setAvailableResources([]);
                              if (rt.type !== 'url') loadPickerResources(rt.type);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                              pickerType === rt.type
                                ? 'bg-brand/10 border-brand/40 text-brand'
                                : 'border-border bg-bg text-muted hover:text-text hover:border-brand/30'
                            }`}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                              <path d={rt.d} />
                            </svg>
                            {rt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Items list */}
                    {pickerType && pickerType !== 'url' && (
                      <div>
                        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                          {pickerType === 'github' ? 'Repositories' : pickerType === 'notion' ? 'Pages' : pickerType === 'slack' ? 'Channels' : 'Files'}
                        </p>
                        {loadingResources ? (
                          <div className="flex items-center gap-2 py-4 text-muted text-sm">
                            <div className="w-3.5 h-3.5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                            Loading…
                          </div>
                        ) : availableResources.length === 0 ? (
                          <p className="text-sm text-muted py-3">No {pickerType} resources found. Make sure you&apos;ve connected {pickerType === 'drive' || pickerType === 'notion' ? 'the integration' : pickerType} in Settings → Connectors.</p>
                        ) : (
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {availableResources.map(r => {
                              const alreadyPinned = project.resources.some(pr => pr.name === r.name && pr.type === pickerType);
                              return (
                                <button
                                  key={r.id}
                                  disabled={alreadyPinned}
                                  onClick={() => {
                                    const res: PinnedResource = { type: pickerType, name: r.name, url: r.url, repo: r.repo, pageId: r.pageId, channelId: r.channelId, fileId: r.fileId };
                                    Object.keys(res).forEach(k => res[k as keyof PinnedResource] === undefined && delete res[k as keyof PinnedResource]);
                                    pinResource(res);
                                  }}
                                  className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                    alreadyPinned
                                      ? 'text-muted/40 cursor-default'
                                      : 'text-text hover:bg-bg hover:text-brand'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{r.name}</p>
                                    {r.sub && <p className="text-[11px] text-muted truncate">{r.sub}</p>}
                                  </div>
                                  {alreadyPinned && <span className="text-[10px] text-muted shrink-0">Pinned</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* URL form */}
                    {pickerType === 'url' && (
                      <div className="space-y-2">
                        <input
                          autoFocus
                          value={urlDraft.name}
                          onChange={e => setUrlDraft(d => ({ ...d, name: e.target.value }))}
                          placeholder="Name (e.g. Design spec)"
                          className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted outline-none focus:border-brand transition-colors"
                        />
                        <input
                          value={urlDraft.url}
                          onChange={e => setUrlDraft(d => ({ ...d, url: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter' && urlDraft.name.trim() && urlDraft.url.trim()) pinUrl(); }}
                          placeholder="https://…"
                          className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted outline-none focus:border-brand transition-colors"
                        />
                        <button
                          onClick={pinUrl}
                          disabled={!urlDraft.name.trim() || !urlDraft.url.trim()}
                          className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
                        >
                          Add URL
                        </button>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        onClick={() => { setShowPicker(false); setPickerType(null); setAvailableResources([]); }}
                        className="text-xs text-muted hover:text-text transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── Tasks Tab ─────────────────────────────────────────────────────── */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              {!addingTask ? (
                <button
                  onClick={() => setAddingTask(true)}
                  className="flex items-center gap-2 text-sm text-muted hover:text-brand transition-colors px-2 py-1 rounded-lg hover:bg-brand/5"
                >
                  <span className="text-base leading-none">+</span> Add task
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    ref={taskInputRef}
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') { setAddingTask(false); setNewTaskTitle(''); } }}
                    placeholder="Task title…"
                    className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted outline-none focus:border-brand transition-colors"
                  />
                  <button onClick={addTask} disabled={!newTaskTitle.trim()} className="px-3 py-2 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors">Add</button>
                  <button onClick={() => { setAddingTask(false); setNewTaskTitle(''); }} className="text-muted hover:text-text transition-colors text-xs">✕</button>
                </div>
              )}

              {activeTasks.length === 0 && doneTasks.length === 0 && (
                <p className="text-muted text-sm text-center py-8">No tasks yet.</p>
              )}

              <div className="space-y-1.5">
                {activeTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-3 group px-2 py-1.5 rounded-lg hover:bg-panel transition-colors">
                    <button onClick={() => toggleTask(t.id, t.done)} className="w-4 h-4 rounded border border-border hover:border-brand flex items-center justify-center shrink-0 transition-colors" />
                    <span className="flex-1 text-sm text-text">{t.title}</span>
                    <button onClick={() => deleteTask(t.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-red-400 text-xs p-1">✕</button>
                  </div>
                ))}
              </div>

              {doneTasks.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowDoneTasks(s => !s)}
                    className="flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors mb-2"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 transition-transform ${showDoneTasks ? 'rotate-180' : ''}`}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                    {doneTasks.length} completed
                  </button>
                  {showDoneTasks && (
                    <div className="space-y-1.5">
                      {doneTasks.map(t => (
                        <div key={t.id} className="flex items-center gap-3 group px-2 py-1.5 rounded-lg hover:bg-panel transition-colors opacity-50">
                          <button onClick={() => toggleTask(t.id, t.done)} className="w-4 h-4 rounded border border-brand bg-brand/20 flex items-center justify-center shrink-0">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 text-brand">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                          <span className="flex-1 text-sm text-muted line-through">{t.title}</span>
                          <button onClick={() => deleteTask(t.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-red-400 text-xs p-1">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Notes Tab ─────────────────────────────────────────────────────── */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              {/* Note input */}
              <div className="bg-panel border border-border rounded-xl p-4 space-y-3">
                <textarea
                  value={newNoteContent}
                  onChange={e => setNewNoteContent(e.target.value)}
                  placeholder="Add a note, win, blocker, or idea…"
                  rows={3}
                  className="w-full bg-transparent text-sm text-text placeholder:text-muted outline-none resize-none"
                />
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {(Object.keys(NOTE_TYPES) as NoteType[]).map(type => (
                      <button
                        key={type}
                        onClick={() => setSelectedNoteType(t => t === type ? undefined : type)}
                        className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-colors ${
                          selectedNoteType === type
                            ? `${NOTE_TYPES[type].bg} ${NOTE_TYPES[type].border} ${NOTE_TYPES[type].color}`
                            : 'border-border text-muted hover:text-text'
                        }`}
                      >
                        {NOTE_TYPES[type].label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={addNote}
                    disabled={!newNoteContent.trim()}
                    className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors font-medium"
                  >
                    Save note
                  </button>
                </div>
              </div>

              {/* Filter chips */}
              <div className="flex gap-1.5 flex-wrap">
                {(['all', ...Object.keys(NOTE_TYPES)] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setNoteFilter(f as 'all' | NoteType)}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                      noteFilter === f
                        ? 'bg-brand/10 border-brand/40 text-brand'
                        : 'border-border text-muted hover:text-text'
                    }`}
                  >
                    {f === 'all' ? 'All' : NOTE_TYPES[f as NoteType].label}
                  </button>
                ))}
              </div>

              {/* Notes list */}
              {sortedNotes.length === 0 ? (
                <p className="text-muted text-sm text-center py-8">No notes yet.</p>
              ) : (
                <div className="space-y-3">
                  {sortedNotes.map(note => (
                    <div
                      key={note.id}
                      className={`bg-panel border rounded-xl p-4 ${note.type ? NOTE_TYPES[note.type].border : 'border-border'}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {note.type && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${NOTE_TYPES[note.type].bg} ${NOTE_TYPES[note.type].color}`}>
                              {NOTE_TYPES[note.type].label}
                            </span>
                          )}
                          {note.pinned && <span className="text-[10px] text-muted">📌</span>}
                          <span className="text-[11px] text-muted">{note.date}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => togglePinNote(note.id)} className="p-1 text-muted hover:text-text transition-colors" title={note.pinned ? 'Unpin' : 'Pin'}>
                            <svg viewBox="0 0 24 24" fill={note.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                            </svg>
                          </button>
                          <button onClick={() => { setEditingNoteId(note.id); setEditDraft(note.content); }} className="p-1 text-muted hover:text-text transition-colors">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button onClick={() => deleteNote(note.id)} className="p-1 text-muted hover:text-red-400 transition-colors">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {editingNoteId === note.id ? (
                        <div>
                          <textarea
                            ref={editNoteRef}
                            value={editDraft}
                            onChange={e => setEditDraft(e.target.value)}
                            rows={3}
                            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-brand transition-colors resize-none"
                          />
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => updateNote(note.id)} className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors">Save</button>
                            <button onClick={() => setEditingNoteId(null)} className="text-xs px-3 py-1.5 border border-border text-muted hover:text-text rounded-lg transition-colors">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">{note.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Right column: chat panel ──────────────────────────────────────────── */}
      <div className="hidden md:flex w-[360px] shrink-0 border-l border-border flex-col">

        {/* Chat tabs */}
        <div className="flex items-center gap-1 px-3 pt-3 pb-0 border-b border-border overflow-x-auto shrink-0">
          {/* Main chat tab */}
          {(() => {
            const isActive = activeChatId === mainChatId;
            return (
              <button
                onClick={() => {
                  const main = allChats.find(c => c.id === mainChatId);
                  if (main) switchChat(main);
                  else { setActiveChatId(mainChatId); }
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive ? 'text-brand border-brand' : 'text-muted border-transparent hover:text-text'
                }`}
              >
                MODUS
              </button>
            );
          })()}

          {/* Extra chat tabs */}
          {extraChats.map(chat => {
            const isActive = activeChatId === chat.id;
            return (
              <div key={chat.id} className="flex items-center group shrink-0">
                {renamingChatId === chat.id ? (
                  <input
                    ref={renameInputRef}
                    value={renamingTitle}
                    onChange={e => setRenamingTitle(e.target.value)}
                    onBlur={() => saveRenameChat(chat.id, renamingTitle)}
                    onKeyDown={e => { if (e.key === 'Enter') saveRenameChat(chat.id, renamingTitle); if (e.key === 'Escape') setRenamingChatId(null); }}
                    onClick={e => e.stopPropagation()}
                    className="w-24 text-xs bg-transparent border-b border-brand text-text outline-none px-1 py-2"
                  />
                ) : (
                  <button
                    onClick={() => switchChat(chat)}
                    onDoubleClick={() => { setRenamingChatId(chat.id); setRenamingTitle(chat.title); }}
                    title={`${chat.title} · double-click to rename`}
                    className={`px-3 py-2 rounded-t-lg text-xs font-medium whitespace-nowrap border-b-2 transition-colors max-w-[100px] truncate ${
                      isActive ? 'text-brand border-brand' : 'text-muted border-transparent hover:text-text'
                    }`}
                  >
                    {chat.title}
                  </button>
                )}
                <button
                  onClick={e => { e.stopPropagation(); deleteChat(chat.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-red-400 text-xs px-0.5 py-2"
                  title="Close"
                >
                  ×
                </button>
              </div>
            );
          })}

          <button
            onClick={startNewChat}
            className="text-muted hover:text-brand transition-colors text-sm px-2 py-2 shrink-0"
            title="New chat"
          >
            +
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map(m => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-border">
          <div className="flex items-end gap-2 bg-panel border border-border rounded-xl px-3 py-2">
            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent); } }}
              placeholder="Ask MODUS about this project…"
              rows={1}
              className="flex-1 bg-transparent text-sm text-text placeholder:text-muted outline-none resize-none max-h-32"
              style={{ height: 'auto', minHeight: '1.5rem' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center hover:bg-brand/90 disabled:opacity-40 transition-colors shrink-0"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-white">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
