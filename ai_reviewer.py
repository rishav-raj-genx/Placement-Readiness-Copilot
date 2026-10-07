import os

from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from langchain_ollama import ChatOllama
from pydantic import BaseModel, Field


load_dotenv()


class ReviewResult(BaseModel):
    score: int = Field(ge=0, le=100)
    is_one_page: bool
    is_ats_friendly: bool
    uses_action_verbs: bool
    specific_fixes: list[str]


def evaluate_text(text: str) -> ReviewResult:
    use_local_mode = os.getenv("USE_LOCAL_MODE", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }

    if use_local_mode:
        model = ChatOllama(model="llama3")
    else:
        model = ChatGroq(model="llama-3.1-8b-instant")

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are a placement officer reviewing a candidate's resume against
professional placement benchmarks. Assess only the resume text provided by the user.
Return a score from 0 to 100 and evaluate whether it is one page, ATS-friendly, and
uses action verbs. Provide specific, practical fixes for weaknesses.
You must return only the requested structured response. Do not add commentary,
markdown, or fields outside the required schema.""",
            ),
            ("human", "{resume_text}"),
        ]
    )
    reviewer = prompt | model.with_structured_output(ReviewResult)
    return reviewer.invoke({"resume_text": text})
