export type AgentState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export type View = 'call' | 'knowledge' | 'transcript';

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  sources?: RetrievedSource[];
}

export interface RetrievedSource {
  text: string;
  score: number;
  document: string;
}

export interface KnowledgeDoc {
  id: string;
  name: string;
  size: number;
  chunks: number;
  status: 'ingesting' | 'ready' | 'error';
  uploadedAt: number;
  error?: string;
}

export interface ChatResponse {
  transcript: string;
  answer: string;
  sources: RetrievedSource[];
  audio: string; // base64-encoded WAV/MP3
  latencyMs: number;
}

export interface IngestResponse {
  id: string;
  name: string;
  chunks: number;
}
