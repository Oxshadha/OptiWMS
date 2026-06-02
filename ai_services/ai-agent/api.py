import os
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent import load_agent, ask
from db_agent import ask_database

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

class DataResponse(BaseModel):
    sql: Optional[str] = None
    data: Optional[list] = None
    chart: Optional[str] = None
    error: Optional[str] = None


class SQLRequest(BaseModel):
    sql: str

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

@app.post("/ask-data", response_model=DataResponse)
def ask_data_question(request: QuestionRequest):
    question = (request.message or request.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="A message is required.")
    df, sql, chart, error = ask_database(question)
    if error:
        return DataResponse(error=error, sql=sql)
    data = df.to_dict(orient="records") if df is not None else None
    return DataResponse(sql=sql, data=data, chart=chart)


@app.post("/query-sql", response_model=DataResponse)
def query_sql(request: SQLRequest):
    sql = request.sql or ""
    if not sql:
        raise HTTPException(status_code=400, detail="A SQL statement is required.")
    from db_agent import run_sql

    df, chart, error = run_sql(sql)
    if error:
        return DataResponse(error=error, sql=sql)
    data = df.to_dict(orient="records") if df is not None else None
    return DataResponse(sql=sql, data=data, chart=chart)
