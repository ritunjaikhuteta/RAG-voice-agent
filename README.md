# Aria — RAG Voice Agent

An enterprise-grade **Retrieval-Augmented Generation voice agent** with a decoupled architecture: a premium React + Vite frontend and a high-performance FastAPI backend. All AI calls route through the **Groq SDK** with a single API key for sub-second latency.

> Talk to your documents. Aria transcribes your voice, retrieves the most relevant passages from a local vector store, reasons with an LLM, and speaks the answer back — in under a second.

---

## Architecture

```
┌──────────────────────────────┐         ┌─────────────────────────────────┐
│  Frontend (React + Vite)     │  HTTP   │  Backend (FastAPI + Python)     │
│  - Tailwind + Framer Motion  │ ──────► │                                 │
│  - Web Audio API mic capture │  /ingest│  ChromaDB (local vector store)  │
│  - Animated voice visualizer │  /chat  │  all-MiniLM-L6-v2 embeddings    │
│  - Knowledge & transcript    │ ◄────── │  Groq: STT → retrieve → LLM → TTS│
└──────────────────────────────┘  audio  └─────────────────────────────────┘
```

**Flow per voice query:**

1. Browser captures microphone audio (Web Audio API + MediaRecorder).
2. `POST /chat` sends the audio blob to FastAPI.
3. Groq **`whisper-large-v3`** transcribes it.
4. Transcript is embedded and the **top 3 chunks** are retrieved from ChromaDB.
5. Context + transcript go to Groq **`llama-3.1-8b-instant`** with a strict "answer only from context" system prompt.
6. The answer is sent to Groq **Text-to-Speech**.
7. Base64-encoded audio + transcript + sources are returned to the frontend and played back seamlessly.

---

## Tech Stack

| Layer        | Technology                                                        |
| ------------ | ----------------------------------------------------------------- |
| Frontend     | React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, lucide-react |
| Backend      | Python, FastAPI, Uvicorn                                          |
| AI / Orchestration | Groq Python SDK, LangChain (text splitters)                 |
| Vector DB    | ChromaDB (local persistent)                                       |
| Embeddings   | `sentence-transformers` — `all-MiniLM-L6-v2` (runs locally)       |
| STT / LLM / TTS | Groq: `whisper-large-v3`, `llama-3.1-8b-instant`, `playai-tts` |

---

## Project Structure

```
.
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.ts
├── src/
│   ├── App.tsx                     # Shell + view routing + chat orchestration
│   ├── main.tsx
│   ├── index.css                   # Theme + component utilities
│   ├── types.ts
│   ├── lib/
│   │   └── api.ts                  # Fetch wrappers for /ingest, /chat, /health
│   ├── hooks/
│   │   └── useAudioRecorder.ts     # Web Audio API mic capture + live amplitude
│   └── components/
│       ├── Sidebar.tsx
│       ├── TopBar.tsx              # Groq badge + backend status + status pill
│       ├── StatusPill.tsx          # Listening / Processing / Speaking states
│       ├── VoiceVisualizer.tsx     # Framer Motion audio bars + pulse rings
│       ├── CallInterface.tsx       # Central animated call area
│       ├── KnowledgePanel.tsx      # Document upload + ingestion status
│       └── TranscriptLog.tsx       # Full conversation history + export
└── backend/
    ├── main.py                     # FastAPI app, CORS, lifespan, /health
    ├── routes.py                   # /ingest + /chat endpoints
    ├── rag.py                      # Embeddings, ChromaDB, Groq STT/LLM/TTS
    ├── schemas.py                  # Pydantic models
    ├── requirements.txt
    └── .env.example
```

---

## Prerequisites

- **Node.js 18+** and npm
- **Python 3.10+**
- A **Groq API key** → get one free at <https://console.groq.com/keys>
- A Chromium-based browser (for `MediaRecorder` + `AudioContext`)

---

## Setup & Run (step-by-step)

### 1. Clone & install frontend dependencies

```bash
npm install
```

### 2. Set up the Python backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure your Groq API key

```bash
cp .env.example .env
# Edit backend/.env and paste your real GROQ_API_KEY
```

### 4. Start the backend server

From the `backend/` directory (with the venv active):

```bash
uvicorn main:app --reload --port 8000
```

The API is now live at `http://localhost:8000`. The `/docs` Swagger UI is available for manual testing.

### 5. Start the frontend dev server

From the project root (a new terminal):

```bash
npm run dev
```

The app opens at `http://localhost:5173`.

### 6. (Optional) Run both concurrently with `concurrently`

For one-command startup, install `concurrently` and add npm scripts:

```bash
npm install -D concurrently
```

Add to `package.json` `scripts`:

```json
"dev:all": "concurrently -n web,api -c cyan,magenta \"npm run dev\" \"cd backend && uvicorn main:app --reload --port 8000\""
```

Then run everything with:

```bash
npm run dev:all
```

---

## Usage

1. **Upload knowledge** — open the **Knowledge** tab, drop a PDF/TXT/MD file. It is chunked, embedded, and stored in ChromaDB.
2. **Make a call** — go to the **Live Call** tab and tap the central orb. Speak your question, then tap again to stop.
3. Aria transcribes, retrieves, reasons, and **speaks the answer back**. The status pill shows each phase live: `Listening… → Processing via Groq… → Speaking…`
4. **Review** the full transcript in the **Transcript** tab and export it as text.

---

## Environment Variables

| Variable         | Where            | Default                                      | Purpose                          |
| ---------------- | ---------------- | -------------------------------------------- | -------------------------------- |
| `GROQ_API_KEY`   | `backend/.env`   | — (required)                                 | Drives all Groq AI calls         |
| `CHROMA_DIR`     | `backend/.env`   | `./chroma_db`                                | ChromaDB persistence path        |
| `CORS_ORIGINS`   | `backend/.env`   | `http://localhost:5173,http://127.0.0.1:5173`| Allowed frontend origins         |
| `VITE_API_BASE`  | project `.env`   | `http://localhost:8000`                      | Backend URL the frontend calls   |

---

## Notes & Constraints Honored

- **Clean mic capture** via Web Audio API with echo cancellation, noise suppression, and auto-gain control.
- **No-jarring playback** — responses play through a dynamically created `Audio` element; no page reloads.
- **Single Groq key** — STT, LLM, and TTS all use `groq.audio.*` / `groq.chat.*` via one `Groq(api_key=…)` client.
- **Strict RAG prompt** — the LLM is instructed to answer only from retrieved context and to say so when it can't.
- **Local embeddings** — `all-MiniLM-L6-v2` runs in-process; no external embedding API call per query.
- **Local vector DB** — ChromaDB persists to disk; no network dependency for retrieval.
```
