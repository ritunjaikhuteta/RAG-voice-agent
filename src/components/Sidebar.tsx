import { motion } from 'framer-motion';
import { Phone, BookOpen, MessageSquare, Mic2, Sparkles } from 'lucide-react';
import type { View } from '../types';

interface SidebarProps {
  view: View;
  setView: (v: View) => void;
  docCount: number;
  chunkCount: number;
}

const NAV: { id: View; label: string; icon: typeof Phone }[] = [
  { id: 'call', label: 'Live Call', icon: Phone },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { id: 'transcript', label: 'Transcript', icon: MessageSquare },
];

export function Sidebar({ view, setView, docCount, chunkCount }: SidebarProps) {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-white/[0.06] bg-ink-900/40 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/[0.06]">
        <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 shadow-glow">
          <Mic2 className="h-5 w-5 text-ink-950" strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">Aria</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Voice Intelligence</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active ? 'text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {active && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-lg bg-white/[0.06] border border-white/[0.08]"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <Icon className="relative h-4.5 w-4.5" strokeWidth={2} />
              <span className="relative">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/[0.06]">
        <div className="rounded-xl border border-white/[0.06] bg-ink-850/60 p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-brand-400" />
            Knowledge Base
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Docs" value={docCount} />
            <Stat label="Chunks" value={chunkCount} />
          </div>
        </div>
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-ink-950/60 px-3 py-2">
      <div className="text-lg font-semibold text-white tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}
