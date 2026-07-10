import { supabase } from './supabase';
import type { KnowledgeDoc, RetrievedSource, TranscriptEntry } from '../types';

// ---- Knowledge docs ---------------------------------------------------------

export async function fetchDocs(): Promise<KnowledgeDoc[]> {
  const { data, error } = await supabase
    .from('knowledge_docs')
    .select('id, name, file_size, chunk_count, status, error_message, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToDoc);
}

export async function insertDoc(
  doc: KnowledgeDoc,
): Promise<void> {
  const { error } = await supabase.from('knowledge_docs').insert({
    id: doc.id,
    name: doc.name,
    file_size: doc.size,
    chunk_count: doc.chunks,
    status: doc.status,
    error_message: doc.error ?? null,
  });
  if (error) throw error;
}

export async function updateDoc(
  id: string,
  patch: Partial<Pick<KnowledgeDoc, 'status' | 'chunks' | 'error'>>,
): Promise<void> {
  const { error } = await supabase
    .from('knowledge_docs')
    .update({
      status: patch.status,
      chunk_count: patch.chunks,
      error_message: patch.error ?? null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteDoc(id: string): Promise<void> {
  const { error } = await supabase.from('knowledge_docs').delete().eq('id', id);
  if (error) throw error;
}

// ---- Transcript + sources ---------------------------------------------------

export async function fetchTranscript(): Promise<TranscriptEntry[]> {
  const { data: entries, error } = await supabase
    .from('transcript_entries')
    .select('id, role, text, created_at, retrieved_sources(document_name, score, chunk_text)')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (entries ?? []).map((row: any) => {
    const sources: RetrievedSource[] | undefined = row.retrieved_sources?.length
      ? row.retrieved_sources.map((s: any) => ({
          text: s.chunk_text,
          score: s.score,
          document: s.document_name,
        }))
      : undefined;
    return {
      id: row.id,
      role: row.role as 'user' | 'assistant',
      text: row.text,
      timestamp: new Date(row.created_at).getTime(),
      sources,
    };
  });
}

export async function insertTranscriptPair(
  userText: string,
  answerText: string,
  sources: RetrievedSource[],
): Promise<void> {
  const { error: userErr } = await supabase
    .from('transcript_entries')
    .insert({ role: 'user', text: userText });
  if (userErr) throw userErr;

  const { data: ansRow, error: ansErr } = await supabase
    .from('transcript_entries')
    .insert({ role: 'assistant', text: answerText })
    .select('id')
    .single();
  if (ansErr) throw ansErr;

  if (sources.length > 0) {
    const rows = sources.map((s) => ({
      transcript_entry_id: ansRow.id,
      document_name: s.document,
      score: s.score,
      chunk_text: s.text,
    }));
    const { error: srcErr } = await supabase.from('retrieved_sources').insert(rows);
    if (srcErr) throw srcErr;
  }
}

// ---- helpers ----------------------------------------------------------------

function rowToDoc(row: any): KnowledgeDoc {
  return {
    id: row.id,
    name: row.name,
    size: row.file_size,
    chunks: row.chunk_count,
    status: row.status,
    error: row.error_message ?? undefined,
    uploadedAt: new Date(row.created_at).getTime(),
  };
}
