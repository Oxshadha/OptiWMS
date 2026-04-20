from fastapi import FastAPI
from pydantic import BaseModel
from agent import load_agent, ask

app = FastAPI(title="OptiWMS Agent API")
chain = load_agent()

class QuestionRequest(BaseModel):
    question: str

class AnswerResponse(BaseModel):
    answer: str
    sources: list[str]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/ask", response_model=AnswerResponse)
def ask_question(request: QuestionRequest):
    answer, sources = ask(chain, request.question)
    return AnswerResponse(answer=answer, sources=sources)