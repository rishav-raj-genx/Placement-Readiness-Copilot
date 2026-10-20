import logging
import os
import uuid
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from src.db.supabase_client import db_client
from src.job_discovery.aggregator import JobAggregator
from src.link_checker.checker import LiveLinkChecker
from src.readiness_score.calculator import PlacementReadinessCalculator
from src.readiness_score.models import ReadinessReport, StudentProfileEvaluation

logger = logging.getLogger("automation_api")

app = FastAPI(
    title="Placement Readiness Automation API",
    description="Live link checking, compliant job discovery, and readiness score aggregation",
    version="1.0.0",
)

security = HTTPBearer(auto_error=False)


def is_e2e_mode() -> bool:
    val = os.environ.get("E2E_MODE") or os.environ.get("AUTOMATION_E2E_MODE") or ""
    return val.lower().strip() in {"1", "true", "yes"}


def verify_service_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> bool:
    """Validates service-to-service authorization token to prevent unauthenticated public calls.
    Fails closed when secret is unconfigured.
    """
    if is_e2e_mode():
        return True

    expected_token = os.environ.get("AUTOMATION_SERVICE_TOKEN") or os.environ.get("INTERNAL_SERVICE_KEY")
    if not expected_token:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "MISCONFIGURED", "message": "Service authorization key not configured"},
        )
    if not credentials or credentials.credentials != expected_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Missing or invalid service authorization token"},
        )
    return True


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
    force_refresh: Optional[bool] = False


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Placement Readiness Automation & Discovery Service",
        "supabase_connected": db_client.is_live,
    }


@app.get("/health")
def health():
    """Liveness probe: verifies automation service is running."""
    return {"status": "ok", "service": "automation-and-job-discovery"}


@app.get("/ready")
def ready():
    """Readiness probe: verifies Supabase and worker readiness."""
    return {
        "status": "ok" if db_client.is_live else "degraded",
        "ready": True,
        "supabase_connected": db_client.is_live,
    }


@app.post("/api/link-check")
def check_link(
    req: LinkCheckRequest,
    _auth: bool = Depends(verify_service_token),
):
    """Triggers headless Playwright mobile check on a live URL behind service authentication."""
    try:
        result = link_checker.check_project_url(
            url=req.url,
            student_id=req.student_id or "student_api",
            project_name=req.project_name or "Project Submission",
            claimed_keywords=req.claimed_keywords,
        )
        return result
    except Exception as e:
        error_id = str(uuid.uuid4())
        logger.error(f"[{error_id}] Link check failed for url {req.url}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "LINK_CHECK_FAILED",
                "message": f"Link verification failed. Reference ID: {error_id}",
            },
        )


@app.post("/api/discover-jobs")
def discover_jobs(
    req: JobSearchRequest,
    _auth: bool = Depends(verify_service_token),
):
    """Fetches jobs from Greenhouse, Lever, and RSS matching boolean criteria with cache control."""
    try:
        jobs = job_aggregator.discover_jobs(
            student_skills=req.skills,
            target_role=req.target_role or "Software Engineer Intern",
            boolean_query=req.boolean_query,
            locations=req.locations,
            max_results=req.max_results or 20,
            force_refresh=req.force_refresh or False,
        )
        freshness = job_aggregator.get_source_freshness()
        return {
            "count": len(jobs),
            "jobs": jobs,
            "freshness": freshness,
        }
    except Exception as e:
        error_id = str(uuid.uuid4())
        logger.error(f"[{error_id}] Job discovery failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "JOB_DISCOVERY_FAILED",
                "message": f"Job discovery failed. Reference ID: {error_id}",
            },
        )


@app.post("/api/calculate-readiness", response_model=ReadinessReport)
def calculate_readiness(
    profile: StudentProfileEvaluation,
    _auth: bool = Depends(verify_service_token),
):
    """Calculates Module 4 composite placement readiness score and top 5 actions."""
    try:
        report = PlacementReadinessCalculator.calculate_readiness(profile, save_to_db=True)
        return report
    except Exception as e:
        error_id = str(uuid.uuid4())
        logger.error(
            f"[{error_id}] Readiness calculation failed for student {profile.student_id}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail={
                "code": "CALCULATION_FAILED",
                "message": f"Readiness calculation failed. Reference ID: {error_id}",
            },
        )
