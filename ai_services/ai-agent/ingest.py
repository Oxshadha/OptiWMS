from agent import DB_HOST
import os
import shutil
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from sqlalchemy import create_engine, text

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma

load_dotenv()

DB_PATH = "db"

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

    print("Loading embedding model (Google GenAI)...")
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=os.getenv("GOOGLE_API_KEY")
    )

    print("Cleaning up old database files if possible...")
    try:
        if os.path.exists(DB_PATH):
            for filename in os.listdir(DB_PATH):
                file_path = os.path.join(DB_PATH, filename)
                try:
                    if os.path.isfile(file_path) or os.path.islink(file_path):
                        os.unlink(file_path)
                    elif os.path.isdir(file_path):
                        shutil.rmtree(file_path)
                except Exception as e:
                    print(f"Failed to delete {file_path}. Reason: {e}")
            print("DB path directory contents cleared.")
    except Exception as e:
        print(f"Warning: could not delete DB path directory: {e}")

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