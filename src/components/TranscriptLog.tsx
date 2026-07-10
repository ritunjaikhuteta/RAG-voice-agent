import { AnimatePresence, motion } from 'framer-motion';
import { Mic, Sparkles, FileText, Download } from 'lucide-react';
import type { TranscriptEntry } from '../types';

interface TranscriptLogProps {
  entries: TranscriptEntry[];
  onExport: () => void;
}

export function TranscriptLog({ entries, onExport }: TranscriptLogProps) {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Conversation Transcript</h2>
          <p className="mt-1 text-sm text-slate-400">{entries.length} exchanges · synced from live calls</p>
        </div>
        {entries.length > 0 && (
          <button onClick={onExport} className="btn-ghost">
            <Download className="h-4 w-4" /> Export
          </button>
        )}
      </div>

      <div className="scrollbar-thin mt-6 flex-1 space-y-4 overflow-y-auto pr-2">
        <AnimatePresence initial={false}>
          {entries.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid h-48 place-items-center rounded-xl border border-white/[0.06] bg-ink-900/40 text-center text-sm text-slate-500"
            >
              No conversation yet. Start a call to see the transcript here.
            </motion.div>
          )}
          {entries.map((e) => (
            <motion.div
              key={e.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${e.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                  e.role === 'user'
                    ? 'bg-white/[0.06] text-slate-300'
                    : 'bg-gradient-to-br from-brand-400 to-accent-500 text-ink-950'
                }`}
              >
                {e.role === 'user' ? <Mic className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              </div>
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  e.role === 'user' ? 'bg-white/[0.05] text-slate-200' : 'glass-strong text-slate-100'
                }`}
              >
                <div>{e.text}</div>
                <div className="mt-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                  {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                {e.sources && e.sources.length > 0 && (
                  <div className="mt-2.5 border-t border-white/[0.06] pt-2">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                      <FileText className="h-3 w-3" /> Sources
                    </div>
                    {e.sources.map((s, i) => (
                      <div key={i} className="truncate text-xs text-slate-400">
                        <span className="font-mono text-brand-400">{(s.score * 100).toFixed(0)}%</span> · {s.document}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
