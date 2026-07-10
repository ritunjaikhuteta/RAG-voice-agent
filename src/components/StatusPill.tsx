import { motion } from 'framer-motion';
import { Circle, Mic, Cpu, Volume2, AlertTriangle } from 'lucide-react';
import type { AgentState } from '../types';

interface StatusPillProps {
  state: AgentState;
}

const CONFIG: Record<
  AgentState,
  { label: string; icon: typeof Mic; dot: string; text: string; ring: string; glow: string }
> = {
  idle: {
    label: 'Standby',
    icon: Circle,
    dot: 'bg-slate-500',
    text: 'text-slate-400',
    ring: 'border-white/[0.08] bg-white/[0.03]',
    glow: '',
  },
  listening: {
    label: 'Listening…',
    icon: Mic,
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    ring: 'border-emerald-400/30 bg-emerald-400/10',
    glow: 'shadow-glow-emerald',
  },
  processing: {
    label: 'Processing via Groq…',
    icon: Cpu,
    dot: 'bg-brand-400',
    text: 'text-brand-300',
    ring: 'border-brand-400/30 bg-brand-400/10',
    glow: 'shadow-glow',
  },
  speaking: {
    label: 'Speaking…',
    icon: Volume2,
    dot: 'bg-accent-400',
    text: 'text-accent-400',
    ring: 'border-accent-400/30 bg-accent-400/10',
    glow: 'shadow-glow',
  },
  error: {
    label: 'Connection error',
    icon: AlertTriangle,
    dot: 'bg-rose-500',
    text: 'text-rose-300',
    ring: 'border-rose-500/30 bg-rose-500/10',
    glow: 'shadow-glow-rose',
  },
};

export function StatusPill({ state }: StatusPillProps) {
  const cfg = CONFIG[state];
  const Icon = cfg.icon;
  const active = state !== 'idle' && state !== 'error';

  return (
    <motion.div
      className={`pill ${cfg.ring} ${cfg.glow} ${cfg.text}`}
      animate={active ? { opacity: [0.85, 1, 0.85] } : { opacity: 1 }}
      transition={{ duration: 1.6, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
    >
      <span className="relative flex h-2 w-2">
        {active && (
          <motion.span
            className={`absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-60`}
            animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${cfg.dot}`} />
      </span>
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      <span className="font-medium">{cfg.label}</span>
    </motion.div>
  );
}
