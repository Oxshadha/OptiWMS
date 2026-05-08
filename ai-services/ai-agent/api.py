import os
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent import load_agent, ask

app = FastAPI(title="OptiWMS Agent API")
chain = load_agent()

allowed_origins = os.getenv(
    "AI_AGENT_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QuestionRequest(BaseModel):
    message: Optional[str] = None
    question: Optional[str] = None
    context: Optional[str] = None
    timestamp: Optional[str] = None

class AnswerResponse(BaseModel):
    answer: str
    sources: list[str]
    context: Optional[str] = None

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/ask", response_model=AnswerResponse)
def ask_question(request: QuestionRequest):
    question = (request.message or request.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="A message is required.")
    answer, sources = ask(chain, question)
    return AnswerResponse(answer=answer, sources=sources, context=request.context)
