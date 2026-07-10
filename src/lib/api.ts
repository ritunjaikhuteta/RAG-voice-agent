import type { ChatResponse, IngestResponse } from '../types';

// Default to local dev backend. Override with VITE_API_BASE in production.
const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8000';

export async function ingestDocument(file: File): Promise<IngestResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/ingest`, { method: 'POST', body: form });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Ingest failed (${res.status}): ${detail}`);
  }
  return res.json();
}

export async function sendChatAudio(audioBlob: Blob): Promise<ChatResponse> {
  const form = new FormData();
  const ext = audioBlob.type.includes('webm') ? 'webm' : 'wav';
  form.append('audio', audioBlob, `recording.${ext}`);
  const res = await fetch(`${API_BASE}/chat`, { method: 'POST', body: form });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Chat failed (${res.status}): ${detail}`);
  }
  return res.json();
}

export async function fetchHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

/** Decode a base64 audio string into a playable Blob URL. */
export function base64ToAudioUrl(b64: string, mime = 'audio/wav'): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}
