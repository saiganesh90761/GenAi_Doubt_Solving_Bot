# Engineering Doubt Solver

An AI-powered RAG chatbot that helps engineering students resolve academic doubts using retrieved context from a pre-indexed document corpus.

Students ask questions in natural language. The app retrieves the most relevant chunks from a local embedding index, then generates an answer with an OpenRouter LLM (OpenAI-compatible API). The goal is a focused, deployable Next.js application — not a multi-service backend.

## Goals

- Answer engineering questions with retrieved context rather than generic chat.
- Keep secrets on the server (API routes / server-only modules).
- Use a simple, Vercel-friendly retrieval path: pre-computed embeddings + in-memory cosine similarity.
- Ship a clean App Router UI with TypeScript and Tailwind CSS.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| LLM | OpenRouter (OpenAI-compatible chat completions) |
| Embeddings | OpenRouter embedding model via `EMBED_MODEL` |
| Retrieval | Pre-computed vectors in `data/index.json`; in-memory cosine similarity at query time |
| Hosting | Vercel |

## Environment variables

Copy `.env.example` to `.env.local` and fill in values. Never commit real keys.

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | OpenRouter API key (server-only) |
| `MODEL_NAME` | Chat model id on OpenRouter |
| `EMBED_MODEL` | Embedding model id on OpenRouter |

## Architecture (target)

```
Browser (App Router UI)
  → Next.js Route Handlers (server)
      → Embed query (OpenRouter)
      → Cosine similarity against data/index.json
      → Chat completion with retrieved chunks (OpenRouter)
  → Stream / return answer + citations
```

- **Index:** `data/index.json` stores chunks (text, source metadata, embedding vectors) produced offline.
- **Query path:** embed the user question, rank chunks by cosine similarity, pass top-k context to the LLM.
- **Secrets:** `OPENROUTER_API_KEY` is used only in server code. It must not appear in client bundles.

## Project structure

```
.
├── PROJECT.md
├── README.md
├── .env.example
├── .gitignore
├── app/
│   ├── page.tsx            # chat UI, sidebar, uploads
│   └── api/
│       ├── chat/route.ts   # RAG chat stream (OpenRouter)
│       ├── upload/route.ts # personal PDF → chunks + embeddings
│       └── library/route.ts# pre-loaded document list
├── lib/
│   ├── openrouter.ts       # OpenAI client → OpenRouter
│   └── rag.ts              # loadIndex, embedQuery, cosine retrieve
├── public/
├── scripts/
│   └── ingest.ts           # PDF → chunks → embeddings → data/index.json
└── data/
    ├── pdfs/               # source PDFs for ingest
    └── index.json          # generated chunk + embedding index
```

## Feature checklist

- [x] Next.js App Router project with TypeScript and Tailwind CSS
- [x] `.env.example` documented; `.env*` ignored by git
- [x] Chat UI for engineering doubts
- [x] Server-only OpenRouter client (`OPENROUTER_API_KEY`, `MODEL_NAME`, `EMBED_MODEL`)
- [x] Offline / build-time embedding pipeline writing `data/index.json`
- [x] In-memory cosine similarity retrieval over the index
- [x] RAG prompt: retrieved chunks + user question → grounded answer
- [x] Source citations (document name and, when available, page/section)
- [x] Engineering-focused system prompt and empty/error states
- [x] Chat history in the session (at minimum; persist later if needed)
- [x] Optional: personal PDF upload and question-answering (later phase)
- [x] Optional: categorized academic PDF library (later phase)
- [ ] Vercel deployment configuration
- [ ] README with local run and deploy steps

## Current status

**Phase:** chat UI with streaming, sources, and personal PDF uploads.

**Done**

- Project intent and stack recorded in this file.
- `.env.example` created with `OPENROUTER_API_KEY`, `MODEL_NAME`, and `EMBED_MODEL`.
- `.gitignore` includes `.env*` with `!.env.example`.
- Next.js App Router + TypeScript + Tailwind CSS initialized in this folder (`engineering-doubt-solver`).
- Dependencies installed: `openai`, `ai` (Vercel AI SDK), `unpdf`, `zod`.
- `lib/openrouter.ts` exports an OpenAI client pointed at `https://openrouter.ai/api/v1` using `OPENROUTER_API_KEY`.
- `scripts/ingest.ts` extracts PDFs from `data/pdfs/` with unpdf, chunks (~800 / 150 overlap), embeds in batches of 32 via OpenRouter (`EMBED_MODEL`), and writes `data/index.json`. Empty (scanned) pages log a warning.
- npm script: `npm run ingest` (`npx tsx scripts/ingest.ts`).
- `lib/rag.ts`: `cosineSimilarity`, cached `loadIndex()`, `embedQuery()`, and `retrieve(query, extraChunks, k)` merging the base index with client-supplied chunks.
- `POST /api/chat` streams `MODEL_NAME` via OpenRouter, retrieves context (base index + `userChunks`), includes the last 4 turns, sends sources as the first SSE event and `X-Rag-Sources` header, and returns friendly 429/API errors.
- Chat UI: markdown + LaTeX, streaming bubbles, expandable sources, mobile sidebar, personal PDF uploads (chunks kept in React state and sent with each request), library list from `GET /api/library`.

**Not started**

- Populating `data/pdfs/` and generating a real `data/index.json` corpus
- Tests and Vercel deploy

**Last updated:** 2026-11-03 — chat UI with markdown/LaTeX, streaming, sources, mobile sidebar, and personal PDF chunks in React state.
