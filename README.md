# CodePilot

CodePilot is an AI-assisted repository understanding platform. It lets users upload a GitHub repository or a ZIP archive, index the codebase, and ask natural-language questions about architecture, data flow, implementation details, and security. The product is built as a three-layer system: a modern Next.js frontend, an Express-based product API, and a Python/FastAPI AI service.

## What is implemented

The current repository includes a working MVP-style workflow for:

- Repository ingestion from ZIP uploads or GitHub URLs
- Project and workspace management for authenticated users
- Repository indexing and metadata persistence in PostgreSQL
- Semantic retrieval using sentence-transformers and Pinecone
- Multi-agent analysis with planner, retrieval, code analysis, security, and report agents
- Streaming chat responses over Server-Sent Events (SSE)
- Subscription plan scaffolding and billing primitives on the server side
- Docker-based local development for the full stack


## Architecture

CodePilot is organized into three main layers:

1. Frontend: Next.js and React for the user experience
2. Server API: Express + Prisma + PostgreSQL for authentication, workspaces, repositories, chat sessions, and subscriptions
3. AI service: FastAPI + LangGraph + Gemini + Pinecone + sentence-transformers for repository analysis and retrieval

The request flow looks like this:

- A repository is uploaded or linked from GitHub
- The server stores repository metadata and forwards indexing work to the AI service
- The AI service chunks the repository, generates embeddings, stores them in Pinecone, and prepares the repository for chat-based analysis
- The frontend streams answers back to the user as the agent workflow runs

## Tech stack

- Frontend: Next.js 14, React, TypeScript, Tailwind CSS
- Server API: Node.js, Express, Prisma, PostgreSQL, JWT, Multer
- AI service: Python 3.12, FastAPI, LangGraph, Gemini 3.5 Flash, Pinecone, sentence-transformers
- Containerization: Docker Compose

## Repository structure

```text
codepilot/
├── backend/                # FastAPI AI service
│   └── app/
│       ├── agents/         # Planner, retrieval, code analysis, security, report
│       ├── api/            # Upload and chat endpoints
│       ├── core/           # Shared settings
│       ├── db/             # SQLAlchemy models and session setup
│       └── services/       # Ingestion, chunking, embeddings, vector search, LLM
├── frontend/               # Next.js application
│   └── src/
│       ├── app/            # Pages and app router routes
│       ├── components/     # UI components for upload, chat, project selection, status
│       ├── context/       # Auth context
│       └── lib/            # API client helpers
├── server/                 # Express API and Prisma schema
│   ├── prisma/            # Database schema and seed data
│   └── src/
│       ├── routes/        # Auth, workspaces, repositories, chat, dashboard, subscriptions
│       └── services/      # Business logic for the product API
├── docker-compose.yml
└── README.md
```

## Local development

### Prerequisites

- Node.js 20+
- Python 3.12+
- Docker Desktop (recommended for PostgreSQL and the full stack)
- A Pinecone account and API key
- A Gemini API key

### Option 1: Run everything with Docker

```bash
docker compose up --build
```

Once running:

- Frontend: http://localhost:3000
- Server API: http://localhost:4000
- AI service: http://localhost:8000
- API docs: http://localhost:8000/docs

### Option 2: Run the services manually

#### 1) Server API

```bash
cd server
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Create a server environment file at server/.env with values such as:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_copilot
JWT_SECRET=replace-me
CORS_ORIGINS=http://localhost:3000
AI_SERVICE_URL=http://localhost:8000
```

#### 2) AI service

```bash
cd backend
python -m venv .venv
# On Windows PowerShell:
# .\.venv\Scripts\Activate.ps1
# On macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Create a backend environment file at backend/.env with values such as:

```env
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/ai_copilot
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=code-copilot
GEMINI_API_KEY=your-gemini-api-key
CORS_ORIGINS=http://localhost:3000
```

#### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

## How the product works

1. A user uploads a ZIP file or pastes a GitHub URL.
2. The server stores the repository metadata and triggers indexing through the AI service.
3. The AI service walks the repository, chunks its contents, generates embeddings, and stores them in Pinecone.
4. The user can then ask questions such as:
   - "Explain the overall architecture"
   - "Find security vulnerabilities"
   - "Describe the authentication flow"
   - "Are there any hardcoded secrets?"
5. The agent workflow retrieves relevant code chunks, analyzes them, and streams a response back to the UI.

## Current status

This repository currently contains a functional MVP-style implementation for repository ingestion, indexing, authentication, workspace management, chat, and AI-assisted analysis. It is suitable for local development and demos. Some production-hardening work remains as future work, including deeper background-job orchestration, expanded billing workflows, and stronger operational safeguards.


