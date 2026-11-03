# Engineering Doubt Solver 🎓🤖

An AI-powered Retrieval-Augmented Generation (RAG) assistant designed for engineering students to resolve complex academic doubts with grounded answers, mathematical derivations, and verifiable textbook citations.

Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **OpenRouter**.

---

## ✨ Features

- **📚 Retrieval-Augmented Generation (RAG)**: Answers are grounded in indexed engineering reference materials, minimizing hallucinations and ensuring academic accuracy.
- **📐 Mathematical & LaTeX Rendering**: Native rendering of equations, circuit formulas, beam bending derivations, and scientific notation via `KaTeX`, `remark-math`, and `rehype-katex`.
- **⚡ Real-Time Streaming Responses**: Token streaming via Server-Sent Events (SSE) with progressive UI updates and markdown formatting.
- **🔍 Verifiable Citations**: Expandable source drawer showing the exact file name, page number, and snippet used to answer each query.
- **📄 On-the-Fly Personal PDF Uploads**: Upload personal course slides or notes directly in the browser; documents are parsed (`unpdf`), chunked, embedded, and queried in-session without requiring permanent database storage.
- **🗂️ Pre-Indexed Corpus Management**: Built-in CLI ingestion pipeline (`npm run ingest`) that extracts, chunks, and pre-computes vector embeddings for reference textbooks into a portable JSON index.
- **📱 Responsive UI**: Clean, accessible desktop and mobile design with dark/light mode compatibility and collapsible drawer.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router & Turbopack) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **LLM & Embeddings** | [OpenRouter](https://openrouter.ai/) (OpenAI-compatible Chat & Embeddings API) |
| **Document Processing**| [unpdf](https://github.com/unjs/unpdf) (Fast PDF text & page extraction) |
| **Math & Markdown** | `react-markdown`, `remark-math`, `rehype-katex`, `katex` |
| **Validation** | [Zod](https://zod.dev/) |
| **Vector Retrieval** | In-memory cosine similarity over pre-computed embeddings |

---

## 🏗️ Architecture

```
User Query / PDF Upload
         │
         ▼
Next.js App Router (Client & Server Handlers)
         ├── /api/upload ──> unpdf text extraction ──> OpenRouter Embedding ──> In-memory session chunks
         ├── /api/chat   ──> Query Embedding (OpenRouter)
         │                     │
         │                     ▼
         │               Cosine Similarity Search
         │               (data/index.json + User Chunks)
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
│   │   ├── chat/route.ts      # Streaming RAG chat endpoint (OpenRouter)
│   │   ├── library/route.ts   # Lists pre-loaded reference documents
│   │   └── upload/route.ts    # Parses and embeds uploaded personal PDFs
│   ├── globals.css            # Tailwind CSS styling and theme setup
│   ├── layout.tsx             # Root layout with fonts and KaTeX styles
│   └── page.tsx               # Primary chat workspace, sidebar, & controls
├── data/
│   ├── index.json             # Pre-computed chunk embeddings (generated)
│   └── pdfs/                  # Source engineering PDFs for ingestion
│       └── .gitkeep
├── lib/
│   ├── chunk.ts               # Text chunking (~800 chars / 150 overlap) & PDF parser
│   ├── embed.ts               # Batch embedding utility via OpenRouter
│   ├── openrouter.ts          # Server-side OpenAI client for OpenRouter
│   ├── rag.ts                 # Cosine similarity & vector retrieval logic
│   └── types.ts               # TypeScript data contracts & interfaces
├── public/                    # Static assets & icons
├── scripts/
│   └── ingest.ts              # Offline pipeline: PDFs → chunks → embeddings
├── .env.example               # Example environment variables template
├── package.json
└── tsconfig.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.18+ or v20+ installed
- **npm**, **pnpm**, or **yarn**
- An **[OpenRouter](https://openrouter.ai/)** account and API key

### 1. Clone the Repository

```bash
git clone https://github.com/saiganesh907/GenAI.git
cd "Gen AI"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file by copying the example template:

```bash
cp .env.example .env.local
```

Open `.env.local` and provide your OpenRouter API key and preferred models:

```env
# OpenRouter API Key (Server-side only, never committed)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Chat Model ID on OpenRouter (e.g. Free Nemotron, Llama 3, Claude, etc.)
MODEL_NAME=nvidia/nemotron-3-ultra-550b-a55b:free

# Embedding Model ID on OpenRouter
EMBED_MODEL=nvidia/nemotron-3-embed-1b:free
```

> 💡 **Tip:** Free models like `nvidia/nemotron-3-ultra-550b-a55b:free` and `nvidia/nemotron-3-embed-1b:free` work out-of-the-box on OpenRouter without incurring API charges.

---

## 📖 Ingestion Pipeline (Adding Reference Materials)

To populate the assistant's permanent knowledge base with course textbooks, syllabi, or engineering reference PDFs:

1. Drop your `.pdf` files into the `data/pdfs/` directory.
2. Run the ingestion script:

```bash
npm run ingest
```

The script will:
- Parse text from each PDF page using `unpdf`.
- Chunk text into standard segment lengths with overlap.
- Embed the chunks in batches through OpenRouter.
- Save the vector records into `data/index.json`.

*(If no PDFs are provided, the system defaults to an empty base index and relies on runtime uploads and general engineering tutor knowledge).*

---

## 💻 Running Locally

### Development Server

Start the local Next.js development server:

```bash
npm run dev
```

Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

### Type Checking & Linting

```bash
# Check TypeScript types
npx tsc --noEmit

# Run ESLint
npm run lint
```

### Production Build

```bash
# Compile optimized production build
npm run build

# Start production server
npm start
```

---

## ☁️ Deployment (Vercel)

The easiest way to deploy this application is using [Vercel](https://vercel.com/):

1. Push your repository to GitHub.
2. Import the project in Vercel.
3. In the Vercel project settings, configure the **Environment Variables**:
   - `OPENROUTER_API_KEY`
   - `MODEL_NAME`
   - `EMBED_MODEL`
4. Deploy! The application uses standard Next.js App Router API routes compatible with Vercel Serverless Functions.

---

## 🛡️ Security & Privacy

- `OPENROUTER_API_KEY` is restricted strictly to server-side route handlers and is never sent to or bundled in client code.
- Personal PDFs uploaded during a user session are embedded on the fly and retained in client component state for that session only.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
