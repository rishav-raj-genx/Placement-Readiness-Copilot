from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from src.db.supabase_client import db_client
from src.job_discovery.aggregator import JobAggregator
from src.link_checker.checker import LiveLinkChecker
from src.readiness_score.calculator import PlacementReadinessCalculator
from src.readiness_score.models import ReadinessReport, StudentProfileEvaluation

app = FastAPI(
    title="Placement Readiness Automation API",
    description="Live link checking, compliant job discovery, and readiness score aggregation",
    version="1.0.0",
)

link_checker = LiveLinkChecker()
job_aggregator = JobAggregator()


class LinkCheckRequest(BaseModel):
    url: str
    student_id: Optional[str] = "student_api"
    project_name: Optional[str] = "Project Submission"
    claimed_keywords: Optional[List[str]] = None


class JobSearchRequest(BaseModel):
    skills: List[str]
    target_role: Optional[str] = "Software Engineer Intern"
    boolean_query: Optional[str] = None
    locations: Optional[List[str]] = None
    max_results: Optional[int] = 20


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Placement Readiness Automation & Discovery Service",
        "supabase_connected": db_client.is_live,
    }


@app.post("/api/link-check")
def check_link(req: LinkCheckRequest):
    """Triggers headless Playwright mobile check on a live URL."""
    try:
        result = link_checker.check_project_url(
            url=req.url,
            student_id=req.student_id or "student_api",
            project_name=req.project_name or "Project Submission",
            claimed_keywords=req.claimed_keywords,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/discover-jobs")
def discover_jobs(req: JobSearchRequest):
    """Fetches jobs from Greenhouse, Lever, and RSS matching boolean criteria."""
    try:
        jobs = job_aggregator.discover_jobs(
            student_skills=req.skills,
            target_role=req.target_role or "Software Engineer Intern",
            boolean_query=req.boolean_query,
            locations=req.locations,
            max_results=req.max_results or 20,
        )
        return {"count": len(jobs), "jobs": jobs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/calculate-readiness", response_model=ReadinessReport)
def calculate_readiness(profile: StudentProfileEvaluation):
    """Calculates Module 4 composite placement readiness score and top 5 actions."""
    try:
        report = PlacementReadinessCalculator.calculate_readiness(profile, save_to_db=True)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
