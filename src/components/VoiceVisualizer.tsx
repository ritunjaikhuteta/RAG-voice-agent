import { motion } from 'framer-motion';
import { useMemo } from 'react';
import type { AgentState } from '../types';

interface VoiceVisualizerProps {
  state: AgentState;
  level: number; // 0..1 mic amplitude while listening
}

const BARS = 56;

/**
 * Premium animated voice visualizer. Three modes:
 *  - listening: bars driven by live mic amplitude (level prop)
 *  - processing: deterministic shimmer wave
 *  - speaking: smooth sinusoidal wave with accent gradient
 *  - idle: gentle resting pulse
 */
export function VoiceVisualizer({ state, level }: VoiceVisualizerProps) {
  const palette = useMemo(() => {
    switch (state) {
      case 'listening':
        return { from: '#34d399', to: '#22d3ee', glow: 'shadow-glow-emerald' };
      case 'processing':
        return { from: '#22d3ee', to: '#8b5cf6', glow: 'shadow-glow' };
      case 'speaking':
        return { from: '#8b5cf6', to: '#22d3ee', glow: 'shadow-glow-lg' };
      default:
        return { from: '#334155', to: '#475569', glow: '' };
    }
  }, [state]);

  const active = state === 'listening' || state === 'speaking' || state === 'processing';

  return (
    <div className="relative flex h-64 items-end justify-center gap-[3px]">
      {/* ambient glow ring */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-full blur-2xl"
        animate={{ opacity: active ? [0.3, 0.6, 0.3] : 0.15 }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ background: `radial-gradient(50% 50% at 50% 60%, ${palette.from}40, transparent 70%)` }}
      />

      {Array.from({ length: BARS }).map((_, i) => {
        const center = (BARS - 1) / 2;
        const dist = Math.abs(i - center) / center; // 0 center .. 1 edge
        const envelope = 1 - dist * 0.65; // taller in the middle

        let target = 0.12;
        if (state === 'listening') {
          // real mic level shaped by position
          target = 0.15 + level * envelope * 1.6;
        } else if (state === 'speaking') {
          target = 0.25 + Math.abs(Math.sin(i * 0.5 + Date.now() / 220)) * 0.6 * envelope;
        } else if (state === 'processing') {
          target = 0.2 + Math.abs(Math.sin(i * 0.9 + Date.now() / 180)) * 0.35;
        } else if (state === 'error') {
          target = 0.08;
        }

        const clamped = Math.min(target, 1);
        const heightPx = Math.max(6, clamped * 220);

        return (
          <motion.div
            key={i}
            className="relative w-[5px] rounded-full"
            style={{
              background: `linear-gradient(to top, ${palette.from}, ${palette.to})`,
              boxShadow: active ? `0 0 12px ${palette.from}66` : 'none',
            }}
            animate={{ height: heightPx }}
            transition={{
              duration: state === 'listening' ? 0.08 : 0.5,
              ease: 'easeOut',
              repeat: state === 'speaking' || state === 'processing' ? Infinity : 0,
              repeatType: 'reverse',
            }}
          />
        );
      })}
    </div>
  );
}

/** Radial concentric pulse rings shown behind the mic button when listening. */
export function PulseRings({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <>
      {[0, 0.6, 1.2].map((delay) => (
        <motion.div
          key={delay}
          className="absolute inset-0 rounded-full border border-emerald-400/40"
          initial={{ scale: 0.85, opacity: 0.6 }}
          animate={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay }}
        />
      ))}
    </>
  );
}
