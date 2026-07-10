"""API routes for ingest + chat."""
from __future__ import annotations

import time
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from .rag import get_rag_engine
from .schemas import ChatResponse, IngestResponse, SourceItem

router = APIRouter()

ALLOWED_TEXT_EXT = {".txt", ".md"}
ALLOWED_PDF_EXT = {".pdf"}
MAX_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("/ingest", response_model=IngestResponse)
async def ingest(file: UploadFile = File(...)) -> IngestResponse:
    """Upload a document, chunk + embed it, and store in ChromaDB."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_TEXT_EXT | ALLOWED_PDF_EXT:
        raise HTTPException(415, f"Unsupported file type '{ext}'. Use PDF, TXT, or MD.")

    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(413, "File exceeds 10MB limit.")
    if not raw:
        raise HTTPException(400, "Empty file.")

    engine = get_rag_engine()
    try:
        doc_id, chunks = engine.ingest_bytes(filename=file.filename or "upload", payload=raw, ext=ext)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"Ingestion failed: {exc}") from exc

    return IngestResponse(id=doc_id, name=file.filename or "upload", chunks=chunks)


@router.post("/chat", response_model=ChatResponse)
async def chat(audio: UploadFile = File(...)) -> ChatResponse:
    """Full voice loop: STT -> retrieve -> LLM -> TTS, returning audio + text."""
    raw = await audio.read()
    if not raw:
        raise HTTPException(400, "Empty audio upload.")

    engine = get_rag_engine()
    t0 = time.perf_counter()

    # 1. Speech-to-text (Groq Whisper)
    transcript = engine.transcribe(raw, audio.filename or "audio.webm")

    # 2. Retrieve top-3 chunks from ChromaDB
    sources = engine.retrieve(transcript, k=3)

    # 3. Generate answer with Groq Llama 3.1 8b instant
    answer = engine.generate(transcript, sources)

    # 4. Text-to-speech (Groq TTS)
    audio_b64 = engine.synthesize(answer)

    latency_ms = int((time.perf_counter() - t0) * 1000)

    return ChatResponse(
        transcript=transcript,
        answer=answer,
        sources=[SourceItem(text=s.text, score=s.score, document=s.document) for s in sources],
        audio=audio_b64,
        latencyMs=latency_ms,
    )
