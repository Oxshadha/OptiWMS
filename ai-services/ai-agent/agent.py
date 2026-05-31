import os
import time
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_classic.chains import RetrievalQA
from langchain_core.prompts import PromptTemplate

load_dotenv()

DB_PATH = "db"
EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

PROMPT_TEMPLATE = """
You are a warehouse operations assistant for OptiWMS.
Answer the user's question using ONLY the information provided in the context below.
If the answer is not in the context, say "I don't have that information in the current SOPs."
Be clear, practical, and concise. If steps are involved, list them.

Context:
{context}

Question:
{question}

Answer:
"""

def load_agent():
    embeddings = HuggingFaceEmbeddings(model_name=EMBED_MODEL)

    vectorstore = Chroma(
        persist_directory=DB_PATH,
        embedding_function=embeddings
    )

    llm = ChatGoogleGenerativeAI(
        model="gemini-3.1-flash-lite",
        google_api_key=os.getenv("GOOGLE_API_KEY"),
        temperature=0.2
    )

    prompt = PromptTemplate(
        template=PROMPT_TEMPLATE,
        input_variables=["context", "question"]
    )

    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=vectorstore.as_retriever(search_kwargs={"k": 4}),
        chain_type_kwargs={"prompt": prompt},
        return_source_documents=True
    )

    return qa_chain

def ask(chain, question: str):
    result = chain.invoke({"query": question})
    answer = result["result"]
    sources = list(set([
        os.path.basename(doc.metadata["source"])
        for doc in result["source_documents"]
    ]))
    return answer, sources
