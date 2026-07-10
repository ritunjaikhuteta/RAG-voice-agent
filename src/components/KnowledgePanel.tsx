import { AnimatePresence, motion } from 'framer-motion';
import { useRef, useState } from 'react';
import { UploadCloud, FileText, Loader2, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import type { KnowledgeDoc } from '../types';
import { ingestDocument } from '../lib/api';

interface KnowledgePanelProps {
  docs: KnowledgeDoc[];
  onIngested: (doc: KnowledgeDoc) => void;
  onRemoved: (id: string) => void;
}

export function KnowledgePanel({ docs, onIngested, onRemoved }: KnowledgePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    setLocalError(null);
    for (const file of Array.from(fileList)) {
      const tempId = `tmp-${Date.now()}-${file.name}`;
      const optimistic: KnowledgeDoc = {
        id: tempId,
        name: file.name,
        size: file.size,
        chunks: 0,
        status: 'ingesting',
        uploadedAt: Date.now(),
      };
      onIngested(optimistic);
      try {
        const res = await ingestDocument(file);
        onIngested({
          id: res.id,
          name: res.name,
          size: file.size,
          chunks: res.chunks,
          status: 'ready',
          uploadedAt: Date.now(),
        });
        onRemoved(tempId);
      } catch (e) {
        onIngested({
          ...optimistic,
          status: 'error',
          error: e instanceof Error ? e.message : 'Ingestion failed',
        });
        onRemoved(tempId);
        setLocalError(e instanceof Error ? e.message : 'Ingestion failed');
      }
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div>
        <h2 className="text-xl font-semibold text-white">Knowledge Base</h2>
        <p className="mt-1 text-sm text-slate-400">
          Upload PDF or TXT documents. Aria chunks, embeds, and indexes them locally for instant retrieval.
        </p>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`group cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${
          dragging
            ? 'border-brand-400 bg-brand-400/5 shadow-glow'
            : 'border-white/[0.1] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <motion.div
          animate={dragging ? { y: -4 } : { y: 0 }}
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-400/20 to-accent-500/20 text-brand-300"
        >
          {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <UploadCloud className="h-7 w-7" />}
        </motion.div>
        <div className="mt-4 text-sm font-medium text-slate-200">
          {busy ? 'Ingesting…' : 'Drop documents here or click to browse'}
        </div>
        <div className="mt-1 text-xs text-slate-500">PDF, TXT, Markdown · max 10MB each</div>
      </div>

      {localError && (
        <div className="pill border-rose-500/30 bg-rose-500/10 text-rose-300">
          <AlertCircle className="h-3.5 w-3.5" /> {localError}
        </div>
      )}

      {/* Document list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-slate-300">Indexed Documents</h3>
          <span className="text-xs text-slate-500">{docs.length} total</span>
        </div>

        <AnimatePresence initial={false}>
          {docs.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-white/[0.06] bg-ink-900/40 p-8 text-center text-sm text-slate-500"
            >
              No documents yet. Upload one to give Aria something to reason over.
            </motion.div>
          )}

          {docs.map((doc) => (
            <motion.div
              key={doc.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="glass flex items-center gap-4 rounded-xl px-4 py-3.5"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-slate-300">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-200">{doc.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                  <span>{formatBytes(doc.size)}</span>
                  {doc.status === 'ready' && <span>· {doc.chunks} chunks</span>}
                </div>
              </div>
              <StatusBadge status={doc.status} />
              {doc.status === 'ready' && (
                <button
                  onClick={() => onRemoved(doc.id)}
                  className="icon-btn h-8 w-8 text-slate-500 hover:text-rose-400"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: KnowledgeDoc['status'] }) {
  if (status === 'ingesting')
    return (
      <span className="pill border-brand-400/30 bg-brand-400/10 text-brand-300">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Ingesting
      </span>
    );
  if (status === 'ready')
    return (
      <span className="pill border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" /> Ready
      </span>
    );
  return (
    <span className="pill border-rose-500/30 bg-rose-500/10 text-rose-300">
      <AlertCircle className="h-3.5 w-3.5" /> Error
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
