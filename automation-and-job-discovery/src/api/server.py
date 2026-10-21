import logging
import os
import uuid
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from src import config
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
    if config.is_production():
        return False
    val = os.environ.get("E2E_MODE") or os.environ.get("AUTOMATION_E2E_MODE") or ""
    return val.lower().strip() in {"1", "true", "yes"}


@app.on_event("startup")
def validate_production_configuration():
    """Refuses to launch in production if E2E bypass modes are active."""
    val = os.environ.get("E2E_MODE") or os.environ.get("AUTOMATION_E2E_MODE") or ""
    if config.is_production() and val.lower().strip() in {"1", "true", "yes"}:
        raise RuntimeError(
            "FATAL CONFIGURATION ERROR: Cannot launch automation service in production with E2E_MODE or AUTOMATION_E2E_MODE enabled."
        )


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
    url: str = Field(..., min_length=1, max_length=2048)
    student_id: Optional[str] = Field("student_api", max_length=128)
    project_name: Optional[str] = Field("Project Submission", max_length=256)
    claimed_keywords: Optional[List[str]] = Field(default=None, max_length=50)


class JobSearchRequest(BaseModel):
    skills: List[str] = Field(..., min_length=1, max_length=50)
    target_role: Optional[str] = Field("Software Engineer Intern", max_length=128)
    boolean_query: Optional[str] = Field(None, max_length=500)
    locations: Optional[List[str]] = Field(None, max_length=20)
    max_results: Optional[int] = Field(20, ge=1, le=100)
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
    """Liveness probe: verifies automation service process is responsive."""
    return {"status": "ok", "service": "automation-and-job-discovery"}


@app.get("/ready")
def ready():
    """Readiness probe: verifies storage operational connectivity and dependencies."""
    is_operational = db_client.check_operational() if db_client.is_live else False
    storage_mode = "supabase" if db_client.is_live else "sqlite_fallback"
    if config.is_production():
        is_ready = is_operational
        readiness_status = "ok" if is_operational else "degraded"
    else:
        # In non-production, SQLite local fallback and E2E modes are fully ready
        is_ready = is_operational or is_e2e_mode() or (not db_client.is_live)
        readiness_status = "ok" if is_ready else "degraded"

    return {
        "status": readiness_status,
        "ready": is_ready,
        "environment": "production" if config.is_production() else ("e2e" if is_e2e_mode() else "development"),
        "storage_mode": storage_mode,
        "supabase_configured": db_client.is_live,
        "supabase_operational": is_operational,
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
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_QUERY",
                "message": str(e),
            },
        )
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
    persist: bool = False,
    _auth: bool = Depends(verify_service_token),
):
    """Calculates Module 4 composite placement readiness score and top 5 actions.
    Pure calculation by default (persist=False). Set persist=True for explicit durable write.
    """
    try:
        report = PlacementReadinessCalculator.calculate_readiness(
            profile,
            save_to_db=persist,
            require_supabase=config.is_production() if persist else False,
        )
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


@app.post("/api/persist-readiness", response_model=ReadinessReport)
def persist_readiness(
    profile: StudentProfileEvaluation,
    _auth: bool = Depends(verify_service_token),
):
    """Explicitly calculates and persists Module 4 composite placement readiness score to database."""
    try:
        report = PlacementReadinessCalculator.calculate_readiness(
            profile,
            save_to_db=True,
            require_supabase=config.is_production(),
        )
        return report
    except Exception as e:
        error_id = str(uuid.uuid4())
        logger.error(
            f"[{error_id}] Readiness persistence failed for student {profile.student_id}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail={
                "code": "PERSISTENCE_FAILED",
                "message": f"Readiness persistence failed. Reference ID: {error_id}",
            },
        )
