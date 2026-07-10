/*
# Create core tables for Aria voice assistant

## Overview
This migration creates three tables to persist data that is currently
held only in React state and lost on every page refresh:
  1. `knowledge_docs` — metadata for uploaded documents (PDF/TXT/MD)
  2. `transcript_entries` — conversation history (user questions + assistant answers)
  3. `retrieved_sources` — knowledge-base chunks cited by each assistant response

## New Tables

### 1. knowledge_docs
Stores metadata for each ingested document. The actual chunk embeddings
live in ChromaDB (local filesystem); this table tracks the document-level
metadata so the Knowledge panel can restore on page reload.
- `id` (uuid, primary key) — matches the doc_id used in ChromaDB
- `name` (text, not null) — original filename
- `file_size` (bigint, not null) — file size in bytes
- `chunk_count` (integer, not null, default 0) — number of chunks produced
- `status` (text, not null, default 'ingesting') — 'ingesting' | 'ready' | 'error'
- `error_message` (text, nullable) — error detail when status = 'error'
- `created_at` (timestamptz, default now()) — upload timestamp

### 2. transcript_entries
Stores each exchange in the conversation (both user messages and
assistant responses), so the Transcript view persists across reloads.
- `id` (uuid, primary key)
- `role` (text, not null) — 'user' | 'assistant'
- `text` (text, not null) — the transcribed user speech or assistant answer
- `created_at` (timestamptz, default now()) — when the exchange occurred

### 3. retrieved_sources
Each assistant response can cite up to 3 knowledge-base chunks. These
are stored as child rows linked to the parent transcript entry.
- `id` (uuid, primary key)
- `transcript_entry_id` (uuid, not null, FK -> transcript_entries.id ON DELETE CASCADE)
- `document_name` (text, not null) — source document filename
- `score` (double precision, not null) — similarity score 0..1
- `chunk_text` (text, not null) — the retrieved text snippet

## Security
This is a single-tenant application with NO sign-in screen. All policies
use `TO anon, authenticated` with `USING (true)` because the data is
intentionally public/shared — the anon-key frontend must be able to
read and write its own data.
- RLS enabled on all three tables.
- 4 CRUD policies (select / insert / update / delete) per table.

## Important Notes
1. `retrieved_sources.transcript_entry_id` has ON DELETE CASCADE so
   deleting a transcript entry automatically removes its cited sources.
2. An index on `transcript_entry_id` speeds up the join when loading
   sources for a given transcript entry.
3. An index on `created_at` on `transcript_entries` keeps the
   transcript ordered efficiently as it grows.
*/

-- ============================================================
-- 1. knowledge_docs
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_docs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  file_size    bigint      NOT NULL,
  chunk_count  integer     NOT NULL DEFAULT 0,
  status       text        NOT NULL DEFAULT 'ingesting'
                 CHECK (status IN ('ingesting', 'ready', 'error')),
  error_message text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_knowledge_docs" ON knowledge_docs;
CREATE POLICY "anon_select_knowledge_docs" ON knowledge_docs
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_knowledge_docs" ON knowledge_docs;
CREATE POLICY "anon_insert_knowledge_docs" ON knowledge_docs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_knowledge_docs" ON knowledge_docs;
CREATE POLICY "anon_update_knowledge_docs" ON knowledge_docs
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_knowledge_docs" ON knowledge_docs;
CREATE POLICY "anon_delete_knowledge_docs" ON knowledge_docs
  FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- 2. transcript_entries
-- ============================================================
CREATE TABLE IF NOT EXISTS transcript_entries (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  role       text        NOT NULL
                 CHECK (role IN ('user', 'assistant')),
  text       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transcript_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_transcript_entries_created_at
  ON transcript_entries (created_at DESC);

DROP POLICY IF EXISTS "anon_select_transcript" ON transcript_entries;
CREATE POLICY "anon_select_transcript" ON transcript_entries
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_transcript" ON transcript_entries;
CREATE POLICY "anon_insert_transcript" ON transcript_entries
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_transcript" ON transcript_entries;
CREATE POLICY "anon_update_transcript" ON transcript_entries
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_transcript" ON transcript_entries;
CREATE POLICY "anon_delete_transcript" ON transcript_entries
  FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- 3. retrieved_sources
-- ============================================================
CREATE TABLE IF NOT EXISTS retrieved_sources (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_entry_id uuid    NOT NULL
    REFERENCES transcript_entries(id) ON DELETE CASCADE,
  document_name       text    NOT NULL,
  score               double precision NOT NULL,
  chunk_text          text    NOT NULL
);

ALTER TABLE retrieved_sources ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_retrieved_sources_entry
  ON retrieved_sources (transcript_entry_id);

DROP POLICY IF EXISTS "anon_select_sources" ON retrieved_sources;
CREATE POLICY "anon_select_sources" ON retrieved_sources
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sources" ON retrieved_sources;
CREATE POLICY "anon_insert_sources" ON retrieved_sources
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sources" ON retrieved_sources;
CREATE POLICY "anon_update_sources" ON retrieved_sources
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sources" ON retrieved_sources;
CREATE POLICY "anon_delete_sources" ON retrieved_sources
  FOR DELETE TO anon, authenticated USING (true);
