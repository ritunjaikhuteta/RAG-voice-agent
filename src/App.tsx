import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { Phone, BookOpen, MessageSquare } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { CallInterface } from './components/CallInterface';
import { KnowledgePanel } from './components/KnowledgePanel';
import { TranscriptLog } from './components/TranscriptLog';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { base64ToAudioUrl, fetchHealth, sendChatAudio } from './lib/api';
import {
  fetchDocs,
  fetchTranscript,
  insertDoc,
  updateDoc,
  deleteDoc,
  insertTranscriptPair,
} from './lib/db';
import type { AgentState, KnowledgeDoc, RetrievedSource, TranscriptEntry, View } from './types';

function App() {
  const [view, setView] = useState<View>('call');
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [lastExchange, setLastExchange] = useState<{
    user: string;
    answer: string;
    sources: RetrievedSource[];
  } | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorder = useAudioRecorder();

  // Backend health check on mount + every 20s
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const ok = await fetchHealth();
      if (mounted) setBackendOnline(ok);
    };
    check();
    const id = window.setInterval(check, 20000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, []);

  // Load persisted docs + transcript from Supabase on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [savedDocs, savedTranscript] = await Promise.all([fetchDocs(), fetchTranscript()]);
        if (!mounted) return;
        if (savedDocs.length) setDocs(savedDocs);
        if (savedTranscript.length) setTranscript(savedTranscript);
      } catch {
        // DB unreachable — app still works with local state
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const playResponseAudio = useCallback((b64: string) => {
    const url = base64ToAudioUrl(b64);
    const audio = new Audio(url);
    setAgentState('speaking');
    audio.onended = () => {
      setAgentState('idle');
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => {
      setAgentState('idle');
      URL.revokeObjectURL(url);
    };
    audio.play().catch(() => setAgentState('idle'));
  }, []);

  const handleToggle = useCallback(async () => {
    setError(null);
    if (recorder.isRecording) {
      setAgentState('processing');
      const blob = await recorder.stop();
      if (!blob) {
        setAgentState('idle');
        setError('No speech detected — try speaking closer to the mic.');
        return;
      }
      try {
        const res = await sendChatAudio(blob);
        setLatencyMs(res.latencyMs);

        const userEntry: TranscriptEntry = {
          id: `u-${Date.now()}`,
          role: 'user',
          text: res.transcript,
          timestamp: Date.now(),
        };
        const assistantEntry: TranscriptEntry = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: res.answer,
          timestamp: Date.now(),
          sources: res.sources,
        };
        setTranscript((prev) => [...prev, userEntry, assistantEntry]);
        setLastExchange({ user: res.transcript, answer: res.answer, sources: res.sources });

        insertTranscriptPair(res.transcript, res.answer, res.sources).catch(() => {});

        if (res.audio) {
          playResponseAudio(res.audio);
        } else {
          setAgentState('idle');
        }
      } catch (e) {
        setAgentState('error');
        setError(e instanceof Error ? e.message : 'Request failed');
        window.setTimeout(() => setAgentState('idle'), 2500);
      }
    } else {
      await recorder.start();
    }
  }, [recorder, playResponseAudio]);

  const addDoc = useCallback((doc: KnowledgeDoc) => {
    setDocs((prev) => {
      const filtered = prev.filter((d) => d.name !== doc.name || d.status !== 'ingesting');
      return [doc, ...filtered];
    });
    if (doc.status === 'ingesting') {
      insertDoc(doc).catch(() => {});
    } else {
      updateDoc(doc.id, { status: doc.status, chunks: doc.chunks, error: doc.error }).catch(() => {});
    }
  }, []);

  const removeDoc = useCallback((id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    deleteDoc(id).catch(() => {});
  }, []);

  const exportTranscript = useCallback(() => {
    const text = transcript
      .map(
        (e) =>
          `[${new Date(e.timestamp).toISOString()}] ${e.role.toUpperCase()}: ${e.text}` +
          (e.sources ? `\n  Sources: ${e.sources.map((s) => s.document).join(', ')}` : ''),
      )
      .join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aria-transcript-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transcript]);

  const readyDocs = docs.filter((d) => d.status === 'ready').length;
  const totalChunks = docs.filter((d) => d.status === 'ready').reduce((s, d) => s + d.chunks, 0);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar view={view} setView={setView} docCount={readyDocs} chunkCount={totalChunks} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar state={agentState} backendOnline={backendOnline} />

        <main className="scrollbar-thin relative flex-1 overflow-y-auto bg-grid-faint bg-grid">
          {/* mobile nav */}
          <div className="flex items-center justify-center gap-2 border-b border-white/[0.06] bg-ink-950/40 px-4 py-2 md:hidden">
            <MobileTab active={view === 'call'} onClick={() => setView('call')} icon={Phone} label="Call" />
            <MobileTab
              active={view === 'knowledge'}
              onClick={() => setView('knowledge')}
              icon={BookOpen}
              label="Knowledge"
            />
            <MobileTab
              active={view === 'transcript'}
              onClick={() => setView('transcript')}
              icon={MessageSquare}
              label="Transcript"
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="min-h-full"
            >
              {view === 'call' && (
                <CallInterface
                  state={agentState}
                  level={recorder.level}
                  isRecording={recorder.isRecording}
                  hasSpeech={recorder.hasSpeech}
                  speechLevel={recorder.speechLevel}
                  onToggle={handleToggle}
                  lastExchange={lastExchange}
                  latencyMs={latencyMs}
                  error={error || recorder.error}
                />
              )}
              {view === 'knowledge' && (
                <KnowledgePanel docs={docs} onIngested={addDoc} onRemoved={removeDoc} />
              )}
              {view === 'transcript' && (
                <TranscriptLog entries={transcript} onExport={exportTranscript} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function MobileTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Phone;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
        active ? 'bg-white/[0.08] text-white' : 'text-slate-400'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

export default App;
