# OptiWMS AI Agent Service

This service acts as the operations copilot and analytics engine for the OptiWMS warehouse management platform. It combines dynamic SQL execution for database querying and report generation, together with a Retrieval-Augmented Generation (RAG) agent for querying Standard Operating Procedures (SOPs).

---

## 🛠️ Technology Stack

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **RAG & Vector Store**: [LangChain](https://www.langchain.com/) & [ChromaDB](https://www.trychroma.com/)
- **Embeddings**: Google GenAI Embeddings (`models/gemini-embedding-001`)
- **LLM Engine**: Gemini Flash (`gemini-3.1-flash-lite` & `gemini-2.5-flash`) via Google Generative AI SDK
- **Database Engine**: SQLAlchemy & Psycopg2 connecting to PostgreSQL

---

## ⚙️ Setup & Configuration

Configure your environment by duplicating `.env.example` to `.env` and updating the values:

```env
GOOGLE_API_KEY="Your Google API Key"
AI_AGENT_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
DB_HOST=localhost
DB_PORT=5434
DB_NAME=optiwms
DB_USER=optiwms
DB_PASSWORD=optiwms
```

---

## 📂 Creating & Updating the Vector DB (Ingestion)

The AI agent's SOP knowledge is stored in a Chroma vector database on disk under the `db/` directory.

### Ingestion Pipeline (`ingest.py`)
Instead of reading from local text files, the ingestion script queries the active PostgreSQL database directly to keep vectors aligned with your live system.

1. **How it Works**:
   - Connects to PostgreSQL using credentials in your `.env`.
   - Fetches active records from the `sops` table (e.g. status = `'active'`).
   - Maps each database entry to a LangChain `Document` containing the SOP content and database-specific metadata (ID, title, category).
   - Splitting: Uses `RecursiveCharacterTextSplitter` to divide contents into 500-character chunks with 50-character overlap.
   - Cleans up and deletes any existing collection or directory in `db/` to prevent stale duplicates.
   - Generates embeddings via `GoogleGenerativeAIEmbeddings` (`models/gemini-embedding-001`) and saves the collection to `db/`.

2. **How to Run Ingestion**:
   Execute the ingestion script using your Conda environment:
   ```bash
   conda run -n optiwmsenv python ingest.py
   ```

---

## 🚀 Running the API Server

Start the FastAPI application with uvicorn:
```bash
conda run -n optiwmsenv uvicorn api:app --reload --host 0.0.0.0 --port 8000
```
- Ingestion runs automatically during FastAPI startup to ensure vectors are initialized.
- Uvicorn runs in reload mode (`--reload`), refreshing the server whenever python source code files are modified.

---

## 🔌 API Endpoints Reference

### 1. Ask Assistant (`POST /ask`)
Primary endpoint for the UI chat. Classifies the query as:
- **`SOP`**: Performs vector search using Chroma DB. Returns conversational answers citing exact database titles as `sources`.
- **`DATA`**: Translates natural language questions to SQL, executes against PostgreSQL, generates visualization charts (via Plotly), and generates conversational summaries or downloadable reports.

**Request Body**:
```json
{
  "message": "What is the safety SOP for forklift operation?",
  "user_id": "user-123",
  "session_id": "session-456"
}
```

### 2. Manual Reindex (`POST /reindex`)
Call this endpoint to manually trigger database-backed SOP ingestion and reload the loaded AI conversational chain with updated vectors.
```bash
curl -X POST http://localhost:8000/reindex
```

### 3. Service Health (`GET /health`)
Simple health check endpoint returning `{"status": "ok"}`.

### 4. Chat History
- **`GET /history/{user_id}`**: Retrieves chat sessions for a specific user.
- **`GET /history/session/{session_id}`**: Retrieves message details of a specific chat session.
- **`DELETE /history/session/{session_id}`**: Deletes a specific chat session and all its message logs.

### 5. Report Download (`GET /download/{filename}`)
Serves PDF analytical reports generated on-demand by the assistant.
