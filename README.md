# Engineering Doubt Solver 🎓🤖

An AI-powered Retrieval-Augmented Generation (RAG) assistant designed for engineering students to resolve complex academic doubts with grounded answers, mathematical derivations, and verifiable textbook citations.

Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Qdrant Cloud**, and **OpenRouter**.

---

## ✨ Features

- **📚 Cloud-Native Vector Retrieval (Qdrant Cloud)**: High-speed, filtered similarity search matching both global academic textbooks and student-specific private uploads.
- **📐 Mathematical & LaTeX Rendering**: Native rendering of equations, circuit formulas, beam bending derivations, and scientific notation via `KaTeX`, `remark-math`, and `rehype-katex`.
- **⚡ Real-Time Streaming Responses**: Token streaming via Server-Sent Events (SSE) with progressive UI updates and markdown formatting.
- **🔍 Verifiable Citations**: Expandable source drawer showing the exact file name, page number, snippet, and relevance score for every answer.
- **📄 Dual Knowledge Scopes**:
  - **Global Scope**: Persistent, admin-managed reference engineering textbooks and course syllabi.
  - **Private Scope**: Session-scoped student PDF uploads indexed on-the-fly and isolated by `ownerId`.
- **🗂️ CLI Ingestion & Migration Pipelines**:
  - `npm run ingest`: Ingests textbooks from `data/pdfs/` into Qdrant Cloud with local backup.
  - `npm run migrate`: Seamlessly migrates existing JSON indexes into Qdrant Cloud.
  - `npm run test:rag`: End-to-end integration verification suite.
- **📱 Responsive UI**: Clean desktop and mobile layout with dark/light mode compatibility.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router & Turbopack) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **Vector Database** | [Qdrant Cloud](https://qdrant.tech/) (`@qdrant/js-client-rest`) |
| **LLM & Embeddings** | [OpenRouter](https://openrouter.ai/) (NVIDIA Nemotron 3 Ultra + Nemotron 3 Embed 1B) |
| **Document Processing**| [unpdf](https://github.com/unjs/unpdf) (Fast PDF text & page extraction) |
| **Math & Markdown** | `react-markdown`, `remark-math`, `rehype-katex`, `katex` |
| **Validation** | [Zod](https://zod.dev/) |

---

## 🏗️ Architecture

```
User Query / PDF Upload
         │
         ▼
Next.js App Router (Client & Serverless Handlers)
         ├── /api/upload ──> unpdf ──> OpenRouter Embedding ──> Qdrant Cloud (private scope)
         ├── /api/chat   ──> Query Embedding (OpenRouter)
         │                     │
         │                     ▼
         │               Qdrant Cloud Vector Search
         │               Filter: global OR ownerId == sessionId
         │                     │
         │                     ▼
         │               Top-k Context + Academic Tutor Prompt
         │                     │
         │                     ▼
         └── OpenRouter LLM Stream (SSE) ──> Client UI with LaTeX & Citations
```

---

## 📂 Project Structure

```text
.
├── app/
│   ├── api/
│   │   ├── chat/route.ts      # Streaming RAG chat endpoint (Qdrant + OpenRouter)
│   │   ├── library/route.ts   # Lists reference documents from Qdrant Cloud
│   │   └── upload/route.ts    # Parses, embeds, and indexes student PDFs into Qdrant
│   ├── globals.css            # Tailwind CSS styling and theme setup
│   ├── layout.tsx             # Root layout with fonts and KaTeX styles
│   └── page.tsx               # Primary chat workspace, sidebar, & controls
├── data/
│   ├── index.json             # Local backup chunk embeddings
│   └── pdfs/                  # Source engineering PDFs for ingestion
│       └── .gitkeep
├── lib/
│   ├── chunk.ts               # Text chunking (~800 chars / 150 overlap) & PDF parser
│   ├── config.ts              # Centralized configuration (Qdrant, models, RAG thresholds)
│   ├── embed.ts               # Batch embedding utility via OpenRouter
│   ├── openrouter.ts          # Server-side OpenAI client for OpenRouter
│   ├── qdrant.ts              # Reusable Qdrant Cloud client, collection init, search & upsert
│   ├── rag.ts                 # Vector retrieval with Qdrant + local fallback
│   └── types.ts               # TypeScript data contracts (VectorChunkPayload, etc.)
├── public/                    # Static assets & icons
├── scripts/
│   ├── ingest.ts              # Ingest PDFs → chunks → embeddings → Qdrant Cloud
│   ├── migrate.ts             # Migrates local index.json records to Qdrant Cloud
│   └── test-rag.ts            # Verification test suite for Qdrant RAG pipeline
├── .env.example               # Example environment variables template
├── package.json
└── tsconfig.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.18+ or v20+ installed
- **npm** or **pnpm**
- An **[OpenRouter](https://openrouter.ai/)** account and API key
- A **[Qdrant Cloud](https://cloud.qdrant.io/)** cluster URL and API key

### 1. Configure Environment Variables

Create `.env.local` by copying the example template:

```bash
cp .env.example .env.local
```

Fill in your credentials:

```env
# OpenRouter API Key
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Chat Model ID on OpenRouter
MODEL_NAME=nvidia/nemotron-3-ultra-550b-a55b:free

# Embedding Model ID on OpenRouter
EMBED_MODEL=nvidia/nemotron-3-embed-1b:free

# Qdrant Cloud Vector Database
QDRANT_URL=https://your-cluster-id.region.gcp.cloud.qdrant.io:6333
QDRANT_API_KEY=your_qdrant_api_key_here
QDRANT_COLLECTION=engineering_doubt_solver
```

### 2. Verify Qdrant Cloud Setup

Run the verification test suite:

```bash
npm run test:rag
```

### 3. Add Reference Engineering Textbooks

1. Drop `.pdf` textbooks or notes into `data/pdfs/`.
2. Run the ingestion pipeline:

```bash
npm run ingest
```

The script will extract text, chunk it, embed it with OpenRouter, and upsert vectors directly to Qdrant Cloud under `knowledgeScope: "global"`.

---

## 💻 Running Locally

```bash
# Start development server
npm run dev

# Check TypeScript types
npx tsc --noEmit

# Run ESLint
npm run lint

# Build production bundle
npm run build
```

---

## ☁️ Deployment (Vercel)

1. Push your repository to GitHub.
2. Import the repository in Vercel.
3. Configure the environment variables in Vercel:
   - `OPENROUTER_API_KEY`
   - `MODEL_NAME`
   - `EMBED_MODEL`
   - `QDRANT_URL`
   - `QDRANT_API_KEY`
   - `QDRANT_COLLECTION`
4. Deploy!

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
