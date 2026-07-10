import { Zap, Github } from 'lucide-react';
import { StatusPill } from './StatusPill';
import type { AgentState } from '../types';

interface TopBarProps {
  state: AgentState;
  backendOnline: boolean | null;
}

export function TopBar({ state, backendOnline }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-white/[0.06] bg-ink-950/60 px-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5">
          <Zap className="h-4 w-4 text-brand-400" fill="currentColor" />
          <span className="text-sm font-semibold text-white">Groq</span>
          <span className="text-xs text-slate-500">· sub-second</span>
        </div>
        <BackendIndicator online={backendOnline} />
      </div>

      <div className="flex items-center gap-3">
        <StatusPill state={state} />
        <a
          href="https://groq.com"
          target="_blank"
          rel="noreferrer"
          className="icon-btn"
          aria-label="Groq"
        >
          <Github className="h-4 w-4" />
        </a>
      </div>
    </header>
  );
}

function BackendIndicator({ online }: { online: boolean | null }) {
  const color =
    online === null ? 'bg-slate-500' : online ? 'bg-emerald-400' : 'bg-rose-500';
  const label = online === null ? 'Checking backend…' : online ? 'Backend online' : 'Backend offline';
  return (
    <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
      <span className={`relative flex h-1.5 w-1.5`}>
        {online && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${color}`} />
      </span>
      {label}
    </div>
  );
}
