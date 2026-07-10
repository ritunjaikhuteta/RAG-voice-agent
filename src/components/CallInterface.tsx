import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff, Loader2, Volume2, FileText, Sparkles } from 'lucide-react';
import { PulseRings, VoiceVisualizer } from './VoiceVisualizer';
import type { AgentState, RetrievedSource } from '../types';

interface CallInterfaceProps {
  state: AgentState;
  level: number;
  speechLevel: number;
  hasSpeech: boolean;
  isRecording: boolean;
  onToggle: () => void;
  lastExchange: { user: string; answer: string; sources: RetrievedSource[] } | null;
  latencyMs: number | null;
  error: string | null;
}

export function CallInterface({
  state,
  level,
  speechLevel,
  hasSpeech,
  isRecording,
  onToggle,
  lastExchange,
  latencyMs,
  error,
}: CallInterfaceProps) {
  const micColor =
    state === 'listening'
      ? 'bg-emerald-500 text-ink-950 shadow-glow-emerald'
      : state === 'processing'
        ? 'bg-brand-500 text-ink-950 shadow-glow'
        : state === 'speaking'
          ? 'bg-accent-500 text-ink-950 shadow-glow-lg'
          : 'bg-white/[0.06] text-white border border-white/[0.1] hover:bg-white/[0.1]';

  return (
    <div className="flex flex-col items-center gap-8 px-6 py-10">
      {/* Headline */}
      <div className="text-center max-w-md">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-balance text-2xl font-semibold text-white"
        >
          Talk to your knowledge base
        </motion.h1>
        <p className="mt-2 text-sm text-slate-400">
          Press the orb and ask anything. Aria transcribes, retrieves, reasons, and replies — in under a second.
        </p>
      </div>

      {/* Visualizer */}
      <div className="relative w-full max-w-xl">
        <VoiceVisualizer state={state} level={level} />
      </div>

      {/* Mic orb */}
      <div className="relative flex flex-col items-center gap-4">
        <div className="relative grid h-24 w-24 place-items-center">
          <PulseRings active={state === 'listening'} />
          <motion.button
            onClick={onToggle}
            disabled={state === 'processing' || state === 'speaking'}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            className={`relative grid h-24 w-24 place-items-center rounded-full transition-colors duration-300 disabled:cursor-not-allowed ${micColor}`}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            <AnimatePresence mode="wait" initial={false}>
              {state === 'processing' ? (
                <motion.span key="proc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Loader2 className="h-9 w-9 animate-spin" />
                </motion.span>
              ) : state === 'speaking' ? (
                <motion.span
                  key="speak"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Volume2 className="h-9 w-9" />
                </motion.span>
              ) : isRecording ? (
                <motion.span key="rec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <MicOff className="h-9 w-9" />
                </motion.span>
              ) : (
                <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Mic className="h-9 w-9" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        <div className="text-center">
          <div className="text-sm font-medium text-slate-300">
            {state === 'processing'
              ? 'Reasoning over your documents…'
              : state === 'speaking'
                ? 'Aria is responding'
                : isRecording
                  ? 'Tap to stop & send'
                  : 'Tap to speak'}
          </div>
          {isRecording && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <div className="flex items-end gap-[3px] h-4">
                {[0.4, 0.7, 1, 0.7, 0.4].map((scale, i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(3, (hasSpeech ? speechLevel * scale : 0.15) * 16)}px`,
                      backgroundColor: hasSpeech ? '#34d399' : '#475569',
                      opacity: hasSpeech ? 0.9 : 0.45,
                    }}
                  />
                ))}
              </div>
              <span className={`text-xs font-medium transition-colors duration-200 ${
                hasSpeech ? 'text-emerald-400' : 'text-slate-500'
              }`}>
                {hasSpeech ? 'Voice detected' : 'Listening for voice…'}
              </span>
            </div>
          )}
          {latencyMs !== null && state === 'idle' && (
            <div className="mt-1 text-xs text-slate-500">
              Last response: <span className="font-mono text-brand-400">{latencyMs}ms</span>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pill border-rose-500/30 bg-rose-500/10 text-rose-300 shadow-glow-rose"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Last exchange preview */}
      <AnimatePresence>
        {lastExchange && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-2xl space-y-3"
          >
            <Bubble role="user" text={lastExchange.user} />
            <Bubble role="assistant" text={lastExchange.answer} sources={lastExchange.sources} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Bubble({
  role,
  text,
  sources,
}: {
  role: 'user' | 'assistant';
  text: string;
  sources?: RetrievedSource[];
}) {
  const isUser = role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
          isUser ? 'bg-white/[0.06] text-slate-300' : 'bg-gradient-to-br from-brand-400 to-accent-500 text-ink-950'
        }`}
      >
        {isUser ? <Mic className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser ? 'bg-white/[0.05] text-slate-200' : 'glass-strong text-slate-100'
        }`}
      >
        {text}
        {sources && sources.length > 0 && (
          <div className="mt-3 border-t border-white/[0.06] pt-2.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
              <FileText className="h-3 w-3" /> Sources ({sources.length})
            </div>
            <div className="space-y-1">
              {sources.map((s, i) => (
                <div key={i} className="truncate text-xs text-slate-400">
                  <span className="font-mono text-brand-400">{(s.score * 100).toFixed(0)}%</span> · {s.document}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
