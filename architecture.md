# DocLink - System Architecture

DocLink is a multimodal Retrieval-Augmented Generation (RAG) workspace. It allows users to upload documents (PDF, DOCX, CSV) and images, and then chat with an AI that understands their content.

Here is the high-level architecture of how DocLink works:

## Architecture Diagram

```mermaid
flowchart TD
    %% Define Nodes
    User([User / Browser])
    React[React Frontend (App.jsx)]
    FastAPI[FastAPI Backend (api.py)]
    
    subgraph Ingestion Pipeline
        ParseDoc[Document Parsers\n(PyPDF, docx)]
        Vision[Vision AI / OCR\n(Groq 11B Vision, Tesseract)]
        Embed[Embedding Model\n(all-MiniLM-L6-v2)]
        FAISS[(FAISS Vector Database)]
    end
    
    subgraph Query Pipeline
        QueryInt[Query Router / Intent Detection]
        CodeInt[Code Interpreter\n(code_interpreter.py)]
        Retriever[Hybrid Search\nFAISS + BM25]
        Reranker[Cross-Encoder Reranker]
        LLM[LLM Engine\n(Groq Llama 3.1 8B)]
        Pandas[(Local Pandas/Python Exec)]
    end

    %% Ingestion Flow
    User -- Uploads File --> React
    React -- POST /ingest --> FastAPI
    FastAPI -- PDF/Text --> ParseDoc
    FastAPI -- Images --> Vision
    ParseDoc -- Chunks Text --> Embed
    Vision -- Image Description --> Embed
    Embed -- Stores Vectors --> FAISS

    %% Query Flow
    User -- Asks Question --> React
    React -- POST /query --> FastAPI
    FastAPI --> QueryInt

    %% Path A: Data Analytics (Code Interpreter)
    QueryInt -- "Math/CSV keywords\n(e.g., average, sum)" --> CodeInt
    CodeInt -- "Generates Pandas Code" --> LLM
    LLM -- "Returns Code" --> CodeInt
    CodeInt -- "Executes Code" --> Pandas
    Pandas -- "Math Output" --> FastAPI

    %% Path B: Standard RAG
    QueryInt -- "Standard Query" --> Retriever
    Retriever -- "Fetches top chunks" --> FAISS
    FAISS -- "Similar Documents" --> Reranker
    Reranker -- "Top 5 Accurate Chunks" --> LLM
    LLM -- "Grounded Answer + Citations" --> FastAPI

    FastAPI -- Returns Answer --> React
    React -- Displays Answer --> User
```

---

## Component Breakdown

### 1. Frontend (React + Vite)
- **UI:** A modern, dynamic dark-themed dashboard.
- **Functions:** Handles file drag-and-drop, displays the chat interface, renders markdown, and manages API state.
- **Communication:** Communicates with the backend exclusively via REST (`/ingest`, `/query`, etc.).

### 2. Backend Server (FastAPI)
- **`api.py`:** The entry point. It receives files and user queries. It routes them to the underlying processing layers.
- **Offline / Online Mode:** Can switch between local models (Ollama) and cloud APIs (Groq API wrapper).

### 3. Ingestion (Storing Data)
- **Documents (`documents.py`):** Extracts raw text from PDFs and DOCX files.
- **Images (`images.py`):** Instead of storing pixels, images are compressed and sent to **Llama 3.2 11B Vision**. The Vision model describes the image in high detail. If offline, Tesseract OCR is used as a fallback.
- **Vectorization:** The text/descriptions are cut into overlapping chunks and passed through HuggingFace's `all-MiniLM-L6-v2` embedding model to generate semantic vectors.
- **Storage:** Vectors are saved locally using **FAISS** (Facebook AI Similarity Search).

### 4. Code Interpreter (For CSVs & Analytics)
- Found in `code_interpreter.py`.
- **Trigger:** If the user query has math terms (average, mean, total, how many) AND a `.csv` file exists in the workspace.
- **Action:** Instead of semantic search, it prompts the LLM to write a Python `pandas` script. It executes that script using `exec()` locally and returns the exact printed result. This completely prevents AI math hallucinations.

### 5. RAG Pipeline (Standard QA)
- **Hybrid Retrieval:** For regular text questions, it uses Semantic Search (FAISS) + Keyword Search (BM25) to find relevant document chunks.
- **Reranking:** A Cross-Encoder model double-checks and re-orders the chunks to ensure only the most relevant context is kept.
- **Generation (`llm.py`):** The LLM is provided the user's question and the retrieved chunks as strict context. It is forced to answer *only* based on the provided evidence and cite its sources.
