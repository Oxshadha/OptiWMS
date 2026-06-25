from agent import DB_HOST
import os
import shutil
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from sqlalchemy import create_engine, text

load_dotenv()

DB_PATH = "db"
EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

def ingest():
    print("Loading documents from PostgreSQL database...")
    DB_HOST     = os.getenv("DB_HOST")
    DB_PORT     = os.getenv("DB_PORT")
    DB_NAME     = os.getenv("DB_NAME")
    DB_USER     = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DATABASE_URL = (
        f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

    engine = create_engine(DATABASE_URL)

    documents = []
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT id, title, category, content, version, status FROM sops WHERE status = 'active'"))
            for row in result:
                sop_id, title, category, content, version, status = row
                doc = Document(
                    page_content=content,
                    metadata={
                        "source": title,
                        "id": str(sop_id),
                        "category": category,
                        "version": version,
                        "title": title
                    }
                )
                documents.append(doc)
    except Exception as e:
        print(f"Error fetching SOPs from PostgreSQL database: {e}")
        return

    print(f"Loaded {len(documents)} active SOP(s) from database.")
    if not documents:
        print("No active SOPs found in database. Ingestion aborted.")
        return

    print("Splitting into chunks...")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    chunks = splitter.split_documents(documents)
    print(f"Created {len(chunks)} chunks")

    print("Loading embedding model (first run downloads ~90MB)...")
    embeddings = HuggingFaceEmbeddings(model_name=EMBED_MODEL)

    print("Cleaning up old database files if possible...")
    try:
        vectorstore = Chroma(
            persist_directory=DB_PATH,
            embedding_function=embeddings
        )
        vectorstore.delete_collection()
        print("Chroma collection deleted.")
    except Exception as e:
        print(f"Chroma delete collection warning: {e}")

    try:
        if os.path.exists(DB_PATH):
            shutil.rmtree(DB_PATH)
            print("DB path directory deleted from disk.")
    except Exception as e:
        print(f"Warning: could not delete DB path directory directly: {e}")

    print("Saving to ChromaDB...")
    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=DB_PATH
    )
    print(f"Done! Vector store saved to '{DB_PATH}/'")
    print(f"Your {len(documents)} database SOPs are ready to be queried.")

if __name__ == "__main__":
    ingest()