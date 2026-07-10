"""
Aria RAG Voice Agent — FastAPI backend.
Entry point: wiring routes, CORS, and startup hooks.
Run with:  uvicorn backend.main:app --reload --port 8000
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .rag import get_rag_engine
from .routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-warm models & vector store on startup so the first request is fast.
    get_rag_engine()
    yield


app = FastAPI(
    title="Aria RAG Voice Agent",
    version="1.0.0",
    description="Retrieval-Augmented Generation voice agent powered by Groq + ChromaDB.",
    lifespan=lifespan,
)

# CORS — allow the Vite dev server and production origins.
_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health() -> dict:
    """Lightweight liveness probe used by the frontend TopBar."""
    return {"status": "ok"}
