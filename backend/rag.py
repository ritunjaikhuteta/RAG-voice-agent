"""
RAG engine: embeddings + ChromaDB + Groq (STT, LLM, TTS) + LangChain chunking.
A single GROQ_API_KEY drives every AI call to keep latency sub-second.
"""
from __future__ import annotations

import base64
import os
import re
import threading
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import chromadb
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Embeddings model (local, lightweight). Loaded lazily so the server boots fast.
_EMBED_MODEL = "all-MiniLM-L6-v2"
_CHROMA_DIR = Path(os.getenv("CHROMA_DIR", "./chroma_db")).resolve()
_COLLECTION = "aria_knowledge"
_GROQ_STT = "whisper-large-v3"
_GROQ_LLM = "llama-3.1-8b-instant"
_GROQ_TTS_VOICE = "Fritz-ML"  # a clear neutral voice


@dataclass
class RetrievedChunk:
    text: str
    score: float
    document: str


def _groq_client():
    """Lazy Groq client. Raises a clear error if the key is missing."""
    from groq import Groq  # imported lazily to keep startup light

    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise RuntimeError("GROQ_API_KEY is not set. Add it to backend/.env or your environment.")
    return Groq(api_key=key)


class _Embedder:
    """Thin wrapper around sentence-transformers so import is lazy."""

    def __init__(self) -> None:
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer(_EMBED_MODEL)

    def encode(self, texts: list[str]) -> list[list[float]]:
        return self.model.encode(texts, normalize_embeddings=True).tolist()


class RAGEngine:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._embedder: Optional[_Embedder] = None
        self._chroma = chromadb.PersistentClient(path=str(_CHROMA_DIR))
        self._collection = self._chroma.get_or_create_collection(
            name=_COLLECTION,
            metadata={"hnsw:space": "cosine"},
        )
        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=600,
            chunk_overlap=80,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        self._groq = None

    # -- lazy singletons -------------------------------------------------

    @property
    def embedder(self) -> _Embedder:
        if self._embedder is None:
            with self._lock:
                if self._embedder is None:
                    self._embedder = _Embedder()
        return self._embedder

    @property
    def groq(self):
        if self._groq is None:
            self._groq = _groq_client()
        return self._groq

    # -- ingestion -------------------------------------------------------

    def ingest_bytes(self, *, filename: str, payload: bytes, ext: str) -> tuple[str, int]:
        """Extract text, chunk, embed, and upsert into ChromaDB."""
        text = self._extract_text(payload, ext)
        if not text.strip():
            raise ValueError("No readable text found in document.")
        chunks = self._splitter.split_text(text)
        if not chunks:
            raise ValueError("Document produced no chunks.")
        doc_id = str(uuid.uuid4())
        embeddings = self.embedder.encode(chunks)
        self._collection.upsert(
            ids=[f"{doc_id}-{i}" for i in range(len(chunks))],
            documents=chunks,
            metadatas=[{"document": filename, "doc_id": doc_id, "index": i} for i in range(len(chunks))],
            embeddings=embeddings,
        )
        return doc_id, len(chunks)

    def _extract_text(self, payload: bytes, ext: str) -> str:
        if ext in {".txt", ".md"}:
            return payload.decode("utf-8", errors="ignore")
        if ext == ".pdf":
            try:
                from pypdf import PdfReader
            except ImportError as exc:
                raise RuntimeError("pypdf is required for PDF ingestion. pip install pypdf") from exc
            import io

            reader = PdfReader(io.BytesIO(payload))
            return "\n\n".join((page.extract_text() or "") for page in reader.pages)
        raise ValueError(f"Unsupported extension: {ext}")

    # -- retrieval -------------------------------------------------------

    def retrieve(self, query: str, k: int = 3) -> list[RetrievedChunk]:
        if self._collection.count() == 0:
            return []
        query_emb = self.embedder.encode([query])[0]
        res = self._collection.query(query_embeddings=[query_emb], n_results=k)
        docs = res.get("documents", [[]])[0]
        metas = res.get("metadatas", [[]])[0]
        dists = res.get("distances", [[]])[0]
        out: list[RetrievedChunk] = []
        for doc, meta, dist in zip(docs, metas, dists):
            score = max(0.0, 1.0 - float(dist))  # cosine distance -> similarity
            out.append(RetrievedChunk(text=doc, score=score, document=meta.get("document", "unknown")))
        return out

    # -- Groq calls ------------------------------------------------------

    def transcribe(self, audio_bytes: bytes, filename: str) -> str:
        import io

        resp = self.groq.audio.transcriptions.create(
            model=_GROQ_STT,
            file=(filename, io.BytesIO(audio_bytes)),
            response_format="text",
        )
        return (resp or "").strip()

    def generate(self, transcript: str, sources: list[RetrievedChunk]) -> str:
        context = "\n\n".join(f"[{i+1}] {s.text}" for i, s in enumerate(sources)) or "No context available."
        system = (
            "You are Aria, a concise voice assistant. Answer ONLY using the provided context. "
            "If the context does not contain the answer, say: 'I don't have enough information to answer that.' "
            "Keep responses under 3 sentences. Be direct, factual, and avoid filler."
        )
        user = f"Context:\n{context}\n\nQuestion: {transcript}"
        completion = self.groq.chat.completions.create(
            model=_GROQ_LLM,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.2,
            max_tokens=256,
        )
        return completion.choices[0].message.content.strip()

    def synthesize(self, text: str) -> str:
        """Groq TTS -> base64-encoded WAV for the frontend <audio> element."""
        import io

        # Strip non-spoken artifacts (markdown, citations) for cleaner speech.
        clean = re.sub(r"\[[0-9]+\]", "", text).replace("**", "")
        resp = self.groq.audio.speech.create(
            model="playai-tts",
            voice=_GROQ_TTS_VOICE,
            input=clean,
            response_format="wav",
        )
        bio = io.BytesIO()
        resp.write_to_file(bio)
        return base64.b64encode(bio.getvalue()).decode("ascii")


# -- module-level singleton ---------------------------------------------------

_engine: Optional[RAGEngine] = None
_engine_lock = threading.Lock()


def get_rag_engine() -> RAGEngine:
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                _engine = RAGEngine()
    return _engine
