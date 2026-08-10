# 💬 AI Agent / Chatbot Service

The **AI Agent Service** acts as the intelligent operations copilot and analytical engine for the OptiWMS warehouse platform. It operates in two modes: a **RAG (Retrieval-Augmented Generation)** assistant for querying Standard Operating Procedures (SOPs), and an **NL-to-SQL database agent** that generates database insights, Plotly charts, and downloadable reports from natural language prompts.

---

## 📂 Code Location & Structure

- **Code Path**: [`ai_services/ai-agent`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/ai-agent)
- **Key Modules**:
  - [`api.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/ai-agent/api.py): FastAPI server, routing endpoints, and chat history handlers.
  - [`agent.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/ai-agent/agent.py): Holds the LangChain RAG pipeline, the ChromaDB vector store wrapper, and SQL generation logic.
  - [`ingest.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/ai-agent/ingest.py): Database-driven SOP vector ingestion pipeline.
  - [`explain_router.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/ai-agent/explain_router.py): Connects to the forecast service to generate natural-language SHAP explanations.

---

## ⚡ Main API Endpoints

The AI Agent runs on **Port `8094`** by default when run in Docker (and **Port `8000`** in standalone development scripts). Interactive documentation is available at `http://localhost:8094/docs`.

### 1. Operations Copilot
- **`POST /ask`**: Processes conversational prompts. It classifies user queries into one of two pipelines:
  - **`SOP` Query**: Performs semantic similarity searches against the Chroma vector database. Returns a natural language response citing the exact SOP document source.
  - **`DATA` Query**: Translates user questions to SQL queries, executes them against PostgreSQL, renders Plotly charts if visualizations are requested, and generates structured analysis summaries.
- **`POST /reindex`**: Re-runs the SOP ingestion pipeline. Downloads active SOPs from PostgreSQL, splits text, updates embeddings in the Chroma vector index, and reloads the RAG chain on the fly.

### 2. Analytical Explanations
- **`POST /api/explain/forecast`** / **`POST /api/explain/forecast/stream`**
  - Fetches forecast figures and precomputed SHAP value attributions from the Forecast Service.
  - Passes features (e.g. `lag_1`, `stockout_days_lag1`) to the Gemini model to explain prediction drivers in natural language.

### 3. Session & Chat History
- **`GET /history/{user_id}`**: Returns session logs for a specific user ID.
- **`GET /history/session/{session_id}`**: Fetches message details of a specific chat session.
- **`DELETE /history/session/{session_id}`**: Deletes a specific chat session and clears its message logs.
- **`GET /download/{filename}`**: Downloads analytical reports (e.g., PDFs) generated on-demand.

---

## ⚙️ RAG & SQL Pipeline Details

### Ingestion Pipeline (`ingest.py`)
To avoid stale documentation files, the ingestion worker connects directly to the live PostgreSQL database:
1. Queries the `sops` table for records marked `active`.
2. Maps each record to a LangChain document containing the title, category, and text content.
3. Splits documents into 500-character segments (with 50-character overlapping).
4. Drops any existing Chroma index in the local [`db/`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/ai-agent/db) directory.
5. Embeds vectors using `GoogleGenerativeAIEmbeddings` (`models/gemini-embedding-001`) and saves them to disk.

### LLM Configurations
- **LLM Models**: Google Gemini via the `google-genai` SDK (`gemini-2.5-flash` for conversational tasks and explanations; `gemini-3.1-flash-lite` for light schema classifications).
- **Security & Authorization**: CORS headers configured via `AI_AGENT_ALLOWED_ORIGINS` to allow cross-origin requests from the React frontend.
