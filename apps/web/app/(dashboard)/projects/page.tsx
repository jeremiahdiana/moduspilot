'use client';

import { useEffect, useState } from 'react';
import {
  collection, onSnapshot, query, orderBy,
  doc, updateDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';

interface PinnedResource {
  type: 'github' | 'notion' | 'slack' | 'drive' | 'url';
  name: string;
}

interface Project {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'archived';
  resources: PinnedResource[];
  createdAt: Date;
}

const RESOURCE_ICONS: Record<PinnedResource['type'], string> = {
  github: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22',
  notion: 'M4 4h16v16H4z',
  slack: 'M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5zM20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5zM3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14zM14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5zM15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zM10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5zM8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z',
  drive: 'M22 16.74L17.74 9H6.26L2 16.74V17l3.06 5.17a1 1 0 00.87.5h12.14a1 1 0 00.87-.5L22 17v-.26zM12 3L7.74 9h8.52L12 3z',
  url: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
};

export default function ProjectsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'archived'>('active');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(collection(db, 'users', user.uid, 'projects'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setProjects(snap.docs.map(d => ({
        id: d.id,
        title: d.data().title ?? 'Untitled',
        description: d.data().description,
        status: (d.data().status as Project['status']) ?? 'active',
        resources: (d.data().resources as PinnedResource[]) ?? [],
        createdAt: d.data().createdAt?.toDate() ?? new Date(),
      })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  async function createProject() {
    if (!user || !form.title.trim()) return;
    setSaving(true);
    const ref = await addDoc(collection(db, 'users', user.uid, 'projects'), {
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: 'active',
      resources: [],
      notes: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setSaving(false);
    setModalOpen(false);
    setForm({ title: '', description: '' });
    router.push(`/projects/${ref.id}`);
  }

  async function archiveProject(id: string) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'projects', id), { status: 'archived' });
  }

  async function restoreProject(id: string) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'projects', id), { status: 'active' });
  }

  const shown = projects.filter(p => p.status === tab);

  return (
    <div className="p-8 overflow-y-auto h-full">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-start justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-text">Projects</h1>
          <p className="text-muted text-sm mt-0.5">Workspaces scoped to specific resources — repos, docs, channels, files.</p>
        </div>
        <button
          onClick={() => { setForm({ title: '', description: '' }); setModalOpen(true); }}
          className="flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand/90 transition-colors shrink-0"
        >
          <span className="text-base leading-none">+</span> New project
        </button>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-panel border border-border rounded-lg p-1 w-fit">
        {([
          { key: 'active',   label: 'Active' },
          { key: 'archived', label: 'Archived' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-brand text-white' : 'text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : shown.length === 0 ? (
        <div className="text-center py-20">
          {tab === 'active' ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-panel border border-border flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-muted">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
              </div>
              <p className="text-muted text-sm mb-1">No projects yet.</p>
              <p className="text-muted/60 text-xs mb-4">Create a workspace and pin resources so MODUS can focus on exactly what matters.</p>
              <button
                onClick={() => { setForm({ title: '', description: '' }); setModalOpen(true); }}
                className="text-sm text-brand hover:underline"
              >
                Create your first project
              </button>
            </>
          ) : (
            <p className="text-muted text-sm">No archived projects.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
          {shown.map((p, i) => (
            <ProjectCard
              key={p.id}
              project={p}
              index={i}
              onClick={() => router.push(`/projects/${p.id}`)}
              onArchive={() => archiveProject(p.id)}
              onRestore={() => restoreProject(p.id)}
            />
          ))}
        </div>
      )}

      {/* New project modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="bg-panel border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-text">New project</h2>
                <button onClick={() => setModalOpen(false)} className="text-muted hover:text-text transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-1.5">Name *</label>
                  <input
                    autoFocus
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter' && form.title.trim()) createProject(); }}
                    placeholder="e.g. Launch v2, Q3 marketing, iOS app"
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-muted outline-none focus:border-brand transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-1.5">
                    Description <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="What are you building or working on?"
                    rows={2}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-muted outline-none focus:border-brand transition-colors resize-none"
                  />
                </div>
                <p className="text-[11px] text-muted">You&apos;ll pin resources (GitHub repos, Notion pages, Slack channels, Drive files) after creating the project.</p>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-text transition-colors">Cancel</button>
                <button
                  onClick={createProject}
                  disabled={!form.title.trim() || saving}
                  className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Creating…' : 'Create project'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProjectCard({
  project, index, onClick, onArchive, onRestore,
}: {
  project: Project;
  index: number;
  onClick: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const resourceTypes = Array.from(new Set(project.resources.map(r => r.type)));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className="bg-panel border border-border rounded-xl p-5 cursor-pointer hover:border-brand/30 transition-colors group relative flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text group-hover:text-brand transition-colors truncate">{project.title}</p>
          {project.description && (
            <p className="text-xs text-muted mt-0.5 line-clamp-2">{project.description}</p>
          )}
        </div>

        {/* 3-dot menu */}
        <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="w-6 h-6 flex items-center justify-center text-muted hover:text-text rounded transition-colors opacity-0 group-hover:opacity-100"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-7 z-50 bg-panel border border-border rounded-xl overflow-hidden shadow-lg w-36"
              >
                {project.status === 'active' ? (
                  <button
                    onClick={() => { onArchive(); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-muted hover:text-text hover:bg-bg transition-colors text-left"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
                    </svg>
                    Archive
                  </button>
                ) : (
                  <button
                    onClick={() => { onRestore(); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-muted hover:text-text hover:bg-bg transition-colors text-left"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <path d="M3 2v6h6M3 13a9 9 0 1 0 3-7.7L3 8"/>
                    </svg>
                    Restore
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Resource type badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {project.resources.length === 0 ? (
          <span className="text-[11px] text-muted/50 italic">No resources pinned yet</span>
        ) : (
          <>
            {resourceTypes.map(type => (
              <span key={type} className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-bg border border-border text-muted">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                  <path d={RESOURCE_ICONS[type as keyof typeof RESOURCE_ICONS]} />
                </svg>
                {type}
              </span>
            ))}
            <span className="text-[11px] text-muted ml-auto">
              {project.resources.length} resource{project.resources.length !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>
    </motion.div>
  );
}
