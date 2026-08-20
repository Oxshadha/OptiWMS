from agent import DB_HOST
import os
import time
from pathlib import Path
import shutil
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from sqlalchemy import create_engine, text

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma

load_dotenv()

# Anchored to this file, not the working directory. A relative "db" meant the
# vector store was created, read, or wiped somewhere different depending on where
# the process happened to be started from -- so a seed run from the repo root and
# the service started from this directory disagreed about where the index lived.
DB_PATH = str((Path(__file__).resolve().parent / "db"))

class ThrottledEmbeddings:
    """Embed in small batches, pausing and retrying when the API pushes back.

    The free embedding tier is rate limited, and sending all thirty chunks at once
    trips it -- a single request succeeds while the batch fails, which is why an
    ingest could look impossible even with quota left. Small batches with a short
    pause, and a backoff on 429, get the whole corpus through.
    """

    def __init__(self, inner, batch_size: int = 5, pause: float = 1.5, attempts: int = 4):
        self._inner = inner
        self._batch_size = batch_size
        self._pause = pause
        self._attempts = attempts

    def _with_retry(self, fn, *args):
        delay = self._pause
        for attempt in range(1, self._attempts + 1):
            try:
                return fn(*args)
            except Exception as exc:
                if "429" not in str(exc) and "quota" not in str(exc).lower():
                    raise
                if attempt == self._attempts:
                    raise
                wait = delay * (2 ** (attempt - 1))
                print(f"  rate limited; waiting {wait:.0f}s before retrying "
                      f"(attempt {attempt}/{self._attempts})")
                time.sleep(wait)
        raise RuntimeError("unreachable")

    def embed_documents(self, texts):
        vectors = []
        total = len(texts)
        for start in range(0, total, self._batch_size):
            batch = texts[start:start + self._batch_size]
            vectors.extend(self._with_retry(self._inner.embed_documents, batch))
            print(f"  embedded {min(start + len(batch), total)}/{total}")
            if start + self._batch_size < total:
                time.sleep(self._pause)
        return vectors

    def embed_query(self, text):
        return self._with_retry(self._inner.embed_query, text)


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
    embeddings = ThrottledEmbeddings(
        GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )
    )

    # Build into a temporary directory and swap it in only once it succeeds.
    #
    # This used to delete the live index first and rebuild afterwards, which is fine
    # until the rebuild fails -- and it does fail, because embedding runs against a
    # free-tier daily quota. Once that quota is spent, a restart destroyed a working
    # index and could not replace it, so SOP retrieval stayed broken until the quota
    # reset. Deleting only after a successful build makes a failed ingest a no-op.
    staging = f"{DB_PATH}.building"
    if os.path.exists(staging):
        shutil.rmtree(staging, ignore_errors=True)

    print("Building the vector store...")
    try:
        Chroma.from_documents(
            documents=chunks,
            embedding=embeddings,
            persist_directory=staging,
        )
    except Exception as exc:
        shutil.rmtree(staging, ignore_errors=True)
        if os.path.exists(DB_PATH):
            print(f"Ingest failed ({exc.__class__.__name__}); keeping the existing "
                  f"index at '{DB_PATH}/'.")
        else:
            print(f"Ingest failed ({exc.__class__.__name__}) and there is no existing "
                  f"index to fall back on. SOP answers are unavailable until this "
                  f"succeeds.")
        raise

    previous = f"{DB_PATH}.previous"
    shutil.rmtree(previous, ignore_errors=True)
    if os.path.exists(DB_PATH):
        os.rename(DB_PATH, previous)
    os.rename(staging, DB_PATH)
    shutil.rmtree(previous, ignore_errors=True)

    print(f"Done! Vector store saved to '{DB_PATH}/'")
    print(f"Your {len(documents)} database SOPs are ready to be queried.")

if __name__ == "__main__":
    ingest()