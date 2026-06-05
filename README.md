# codepilot

A AI-powered code analysis API. Upload a GitHub repo or ZIP file and query it in plain English — the system retrieves semantically relevant code chunks and runs a multi-agent LangGraph pipeline to generate answers, streamed live via SSE.

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | FastAPI, Python 3.11 |
| Database | PostgreSQL 15, SQLAlchemy (async) |
| Embeddings | sentence-transformers `all-MiniLM-L6-v2` (local, 384-dim) |
| Vector DB | Pinecone (free serverless, cosine similarity) |
| LLM | Groq (`qwen/qwen3-32b`) |
| Agents | LangGraph |
| Streaming | Server-Sent Events (SSE) |
| Container | Docker + docker-compose |

---

## Project Structure

```
ai-copilot/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── state.py            
│   │   │   ├── graph.py           
│   │   │   ├── planner.py         
│   │   │   ├── retrieval.py        
│   │   │   ├── code_analysis.py    
│   │   │   ├── security.py         
│   │   │   └── report.py           
│   │   ├── api/
│   │   │   ├── upload.py           
│   │   │   └── chat.py             
│   │   ├── core/
│   │   │   └── config.py           
│   │   ├── db/
│   │   │   ├── models.py           
│   │   │   └── session.py          
│   │   ├── services/
│   │   │   ├── file_walker.py      
│   │   │   ├── chunker.py          
│   │   │   ├── embedder.py         
│   │   │   ├── vector_store.py     
│   │   │   └── ingestion.py        
│   │   └── main.py                 
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## Getting Started

### 1. Clone and configure

```bash
git clone <this-repo>
cd codepilot
cp backend/.env.example backend/.env
# Fill in PINECONE_API_KEY and GROQ_API_KEY in backend/.env
```

### 2. Run with Docker

```bash
docker compose up --build
```

API available at: `http://localhost:8000`  
Interactive docs: `http://localhost:8000/docs`

### 3. Run locally (without Docker)

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

## API Endpoints

### Upload

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload/zip` | Upload a `.zip` of a repo |
| `POST` | `/api/upload/github` | Clone a GitHub repo by URL |
| `GET` | `/api/upload/projects` | List all ingested projects |

**Upload ZIP**
```bash
curl -X POST http://localhost:8000/api/upload/zip \
  -F "file=@myrepo.zip" \
  -F "project_name=myrepo"
```

**Clone GitHub repo**
```bash
curl -X POST http://localhost:8000/api/upload/github \
  -F "github_url=https://github.com/owner/repo"
```

Response:
```json
{ "project_id": "uuid-here", "name": "myrepo", "status": "ready" }
```

---

### Chat (SSE Streaming)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat/stream` | Ask a question, get streamed answer |
| `GET` | `/api/chat/history/{project_id}` | Fetch last 20 conversation turns |

**Ask a question**
```bash
curl -X POST http://localhost:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"project_id": "your-project-id", "question": "explain the auth flow"}'
```

**SSE response format**
```
data: {"type": "status", "message": "🧠 Planning which agents to run..."}
data: {"type": "status", "message": "🔍 Retrieving top 10 relevant code chunks..."}
data: {"type": "status", "message": "💻 Running Code Analysis agent..."}
data: {"type": "chunk", "token": "The "}
data: {"type": "chunk", "token": "authentication "}
...
data: {"type": "done", "agents_used": ["code_analysis"]}
```

---

## How It Works

```
POST /api/chat/stream
        │
        ▼
   retrieval node      ← embed query → Pinecone top-10 chunks
        │
        ▼
   planner node        ← decides: code_analysis | security | both
        │
   ┌────┴────┐
   ▼         ▼
code_analysis  security
   └────┬────┘
        ▼
   report node         ← merges outputs into clean markdown
        │
        ▼
   SSE stream          ← token-by-token to client
        │
        ▼
   PostgreSQL          ← saves Q&A + agents used
```

---

## Required API Keys

| Service | Free Tier | Link |
|---|---|---|
| Pinecone | ✅ Yes | https://app.pinecone.io |
| Groq | ✅ Yes | https://console.groq.com |

No OpenAI key needed — embeddings run fully locally.

---

## Example Queries

```
"Explain the overall architecture of this codebase"
"Find any SQL injection vulnerabilities"
"Describe the authentication and authorization flow"
"Are there any hardcoded secrets or API keys?"
"What does the UserService class do?"
```
