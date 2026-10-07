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


class GithubReview(BaseModel):
    score: int = Field(ge=0, le=100)
    specific_fixes: list[str]


def _get_chat_model():
    use_local_mode = os.getenv("USE_LOCAL_MODE", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }

    if use_local_mode:
        return ChatOllama(model="llama3")
    return ChatGroq(model="llama-3.1-8b-instant")


def evaluate_text(text: str) -> ReviewResult:
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
    reviewer = prompt | _get_chat_model().with_structured_output(ReviewResult)
    return reviewer.invoke({"resume_text": text})


def evaluate_github(github_data: dict) -> GithubReview:
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are a placement officer reviewing a candidate's GitHub
profile against software-engineering placement benchmarks. Assess the quality,
consistency, technical relevance, documentation, and evidence of impact in the
provided GitHub profile and repositories. Return a score from 0 to 100 and
specific, practical fixes for improving the repositories.
You must return only the requested structured response. Do not add commentary,
markdown, or fields outside the required schema.""",
            ),
            ("human", "{github_data}"),
        ]
    )
    reviewer = prompt | _get_chat_model().with_structured_output(GithubReview)
    return reviewer.invoke({"github_data": str(github_data)})
