import os
from dotenv import load_dotenv
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

load_dotenv()

DOCS_PATH = "docs"
DB_PATH = "db"
EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

def ingest():
    print("Loading documents...")
    loader = DirectoryLoader(
        DOCS_PATH,
        glob="**/*.txt",
        loader_cls=TextLoader,
        loader_kwargs={"encoding": "utf-8"}
    )
    documents = loader.load()
    print(f"Loaded {len(documents)} document(s)")

    print("Splitting into chunks...")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    chunks = splitter.split_documents(documents)
    print(f"Created {len(chunks)} chunks")

    print("Loading embedding model (first run downloads ~90MB)...")
    embeddings = HuggingFaceEmbeddings(model_name=EMBED_MODEL)

    print("Saving to ChromaDB...")
    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=DB_PATH
    )
    print(f"Done! Vector store saved to '{DB_PATH}/'")
    print(f"Your {len(documents)} SOPs are ready to be queried.")

if __name__ == "__main__":
    ingest()