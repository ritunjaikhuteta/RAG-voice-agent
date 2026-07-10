"""Pydantic response schemas."""
from __future__ import annotations

from pydantic import BaseModel, Field


class SourceItem(BaseModel):
    text: str
    score: float
    document: str


class IngestResponse(BaseModel):
    id: str
    name: str
    chunks: int


class ChatResponse(BaseModel):
    transcript: str
    answer: str
    sources: list[SourceItem] = Field(default_factory=list)
    audio: str  # base64-encoded WAV
    latencyMs: int
