import os
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from .env
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
# SUPABASE_KEY is retained only as a backwards-compatible server-side alias.
SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY or os.getenv("SUPABASE_KEY", "").strip()
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "project-screenshots").strip()

# Browser & Link Checking
HEADLESS_BROWSER = os.getenv("HEADLESS_BROWSER", "true").lower() in ("true", "1", "yes")
SCREENSHOT_DIR = BASE_DIR / os.getenv("SCREENSHOT_DIR", "data/screenshots")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_VIEWPORT_WIDTH = int(os.getenv("DEFAULT_VIEWPORT_WIDTH", "375"))
DEFAULT_VIEWPORT_HEIGHT = int(os.getenv("DEFAULT_VIEWPORT_HEIGHT", "812"))
BROWSER_TIMEOUT_MS = int(os.getenv("BROWSER_TIMEOUT_MS", "25000"))

# Job Discovery
JSEARCH_API_KEY = os.getenv("JSEARCH_API_KEY", "").strip()
MAX_JOBS_PER_SOURCE = int(os.getenv("MAX_JOBS_PER_SOURCE", "30"))
AUTOMATION_E2E_MODE = os.getenv("AUTOMATION_E2E_MODE", "false").lower() in (
    "true",
    "1",
    "yes",
)

# Environment mode
ENVIRONMENT = (
    os.getenv("ENVIRONMENT") or os.getenv("APP_ENV") or os.getenv("NODE_ENV") or "development"
).lower().strip()


def is_production() -> bool:
    return ENVIRONMENT in ("production", "prod")


# Local Data Cache / Fallback directory
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
