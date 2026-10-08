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


class LinkedInReviewResult(BaseModel):
    score: int = Field(ge=0, le=100)
    has_complete_profile: bool
    skills_relevant: bool
    suggested_rewrites: list[str]


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


def evaluate_linkedin_text(text: str) -> LinkedInReviewResult:
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are a tech recruiter evaluating a candidate's LinkedIn
profile from a LinkedIn "Save to PDF" export. Assess the profile against
technology-industry recruiting benchmarks. Set has_complete_profile to true only
when the export contains both a meaningful headline and an About section. Set
skills_relevant to true only when the listed skills are relevant to the
candidate's apparent target technical roles. Provide suggested_rewrites as
ready-to-paste improvements for the headline, About section, skills, or other
profile content.
You must return only a response matching the LinkedInReviewResult schema exactly.
Do not add commentary, markdown, or fields outside that schema.""",
            ),
            ("human", "{linkedin_text}"),
        ]
    )
    reviewer = prompt | _get_chat_model().with_structured_output(LinkedInReviewResult)
    return reviewer.invoke({"linkedin_text": text})
