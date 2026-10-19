import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from src import config

logger = logging.getLogger("supabase_client")


class SupabaseHandler:
    """
    Handles pushing data to Member 1's Supabase database and Storage bucket.
    Includes automatic fallback to local SQLite when credentials are not configured yet.
    """

    def __init__(self):
        self.supabase = None
        self.is_live = False
        self._init_client()
        self._init_local_fallback()

    def _init_client(self):
        if config.SUPABASE_URL and config.SUPABASE_KEY:
            try:
                from supabase import Client, create_client

                self.supabase: Client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)
                self.is_live = True
                logger.info(f"Connected successfully to Supabase at: {config.SUPABASE_URL}")
            except Exception as e:
                logger.warning(
                    f"Failed to initialize Supabase client: {e}. Falling back to local storage."
                )
                self.is_live = False
        else:
            logger.info(
                "Supabase credentials not configured. Running in Local Storage Fallback mode."
            )
            self.is_live = False

    def _init_local_fallback(self):
        """Initializes a local SQLite fallback database inside data/local_cache.db."""
        self.local_db_path = config.DATA_DIR / "local_cache.db"
        conn = sqlite3.connect(self.local_db_path)
        cursor = conn.cursor()

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS project_live_checks (
            id TEXT PRIMARY KEY,
            student_id TEXT,
            project_name TEXT,
            project_url TEXT,
            status_code INTEGER,
            is_live INTEGER,
            load_time_ms INTEGER,
            mobile_friendly INTEGER,
            screenshot_url TEXT,
            console_errors TEXT,
            network_errors TEXT,
            content_evaluation TEXT,
            quality_score REAL,
            created_at TEXT
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS discovered_jobs (
            id TEXT PRIMARY KEY,
            title TEXT,
            company TEXT,
            location TEXT,
            url TEXT UNIQUE,
            source TEXT,
            matched_skills TEXT,
            relevance_score REAL,
            match_reason TEXT,
            is_remote INTEGER,
            job_type TEXT,
            posted_at TEXT,
            created_at TEXT
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS readiness_scores (
            id TEXT PRIMARY KEY,
            student_id TEXT UNIQUE,
            total_score REAL,
            readiness_level TEXT,
            breakdown TEXT,
            top_actions TEXT,
            raw_inputs TEXT,
            algorithm_version TEXT DEFAULT 'v1.0.0',
            updated_at TEXT
        )
        """)
        readiness_columns = {
            str(row[1]) for row in cursor.execute("PRAGMA table_info(readiness_scores)").fetchall()
        }
        if "algorithm_version" not in readiness_columns:
            cursor.execute(
                "ALTER TABLE readiness_scores ADD COLUMN algorithm_version TEXT DEFAULT 'v1.0.0'"
            )
        conn.commit()
        conn.close()

    def upload_screenshot(
        self, local_image_path: Path, remote_filename: Optional[str] = None
    ) -> str:
        """
        Uploads screenshot to Supabase Storage bucket 'project-screenshots'.
        If Supabase is not connected, returns the local file path as file:// URI.
        """
        if not local_image_path.exists():
            return ""

        filename = remote_filename or local_image_path.name

        if self.is_live and self.supabase:
            try:
                bucket = config.SUPABASE_STORAGE_BUCKET
                with open(local_image_path, "rb") as f:
                    file_bytes = f.read()

                # Upload to Supabase Storage
                self.supabase.storage.from_(bucket).upload(
                    path=filename,
                    file=file_bytes,
                    file_options={"content-type": "image/png", "upsert": "true"},
                )
                public_url = self.supabase.storage.from_(bucket).get_public_url(filename)
                logger.info(f"Uploaded screenshot to Supabase: {public_url}")
                return public_url
            except Exception as e:
                logger.warning(
                    f"Could not upload screenshot to Supabase storage ({e}). Using local path."
                )

        return str(local_image_path.resolve())

    def save_live_link_check(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Pushes project link check result to Supabase or local SQLite."""
        import uuid

        raw_id = data.get("id")
        # Ensure valid UUID
        try:
            if raw_id:
                record_id = str(uuid.UUID(str(raw_id)))
            else:
                record_id = str(uuid.uuid4())
        except Exception:
            record_id = str(uuid.uuid4())

        payload = {
            "id": record_id,
            "student_id": data.get("student_id", "default_student"),
            "project_name": data.get("project_name", "Untitled Project"),
            "project_url": data.get("project_url", ""),
            "status_code": data.get("status_code"),
            "is_live": data.get("is_live", False),
            "load_time_ms": data.get("load_time_ms", 0),
            "mobile_friendly": data.get("mobile_friendly", False),
            "screenshot_url": data.get("screenshot_url", ""),
            "console_errors": data.get("console_errors", []),
            "network_errors": data.get("network_errors", []),
            "content_evaluation": data.get("content_evaluation", {}),
            "quality_score": data.get("quality_score", 0.0),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        if self.is_live and self.supabase:
            try:
                res = self.supabase.table("project_live_checks").insert(payload).execute()
                return {"success": True, "source": "supabase", "data": res.data}
            except Exception as e:
                logger.error(f"Error inserting into Supabase: {e}. Storing locally.")

        # Local SQLite storage fallback
        conn = sqlite3.connect(self.local_db_path)
        cur = conn.cursor()
        cur.execute(
            """
            INSERT OR REPLACE INTO project_live_checks VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
            (
                payload["id"],
                payload["student_id"],
                payload["project_name"],
                payload["project_url"],
                payload["status_code"],
                int(payload["is_live"]),
                payload["load_time_ms"],
                int(payload["mobile_friendly"]),
                payload["screenshot_url"],
                json.dumps(payload["console_errors"]),
                json.dumps(payload["network_errors"]),
                json.dumps(payload["content_evaluation"]),
                payload["quality_score"],
                payload["created_at"],
            ),
        )
        conn.commit()
        conn.close()

        return {"success": True, "source": "local_sqlite", "id": record_id}

    def save_discovered_jobs(self, jobs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Pushes list of discovered jobs to Supabase or local SQLite."""
        if not jobs:
            return {"success": True, "count": 0}

        # Filter strictly to schema columns
        allowed_columns = {
            "id",
            "title",
            "company",
            "location",
            "url",
            "source",
            "description",
            "required_skills",
            "matched_skills",
            "relevance_score",
            "match_reason",
            "is_remote",
            "job_type",
            "employment_type",
            "publication_status",
            "posted_at",
            "updated_at",
        }
        cleaned_jobs = [{k: v for k, v in job.items() if k in allowed_columns} for job in jobs]

        saved_count = 0
        if self.is_live and self.supabase:
            try:
                # Upsert into Supabase
                res = (
                    self.supabase.table("discovered_jobs")
                    .upsert(cleaned_jobs, on_conflict="url")
                    .execute()
                )
                return {
                    "success": True,
                    "source": "supabase",
                    "count": len(res.data) if res.data else len(cleaned_jobs),
                }
            except Exception as e:
                logger.error(f"Error upserting jobs into Supabase: {e}. Storing locally.")

        # Local fallback
        conn = sqlite3.connect(self.local_db_path)
        cur = conn.cursor()
        for job in jobs:
            try:
                cur.execute(
                    """
                    INSERT OR REPLACE INTO discovered_jobs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                    (
                        job.get("id"),
                        job.get("title"),
                        job.get("company"),
                        job.get("location"),
                        job.get("url"),
                        job.get("source"),
                        json.dumps(job.get("matched_skills", [])),
                        job.get("relevance_score", 0.0),
                        job.get("match_reason", ""),
                        int(job.get("is_remote", False)),
                        job.get("job_type", "internship/entry-level"),
                        job.get("posted_at", datetime.now(timezone.utc).isoformat()),
                        datetime.now(timezone.utc).isoformat(),
                    ),
                )
                saved_count += 1
            except Exception as e:
                logger.warning(f"Could not save job {job.get('id')}: {e}")
        conn.commit()
        conn.close()

        return {"success": True, "source": "local_sqlite", "count": saved_count}

    def save_readiness_score(self, score_data: Dict[str, Any]) -> Dict[str, Any]:
        """Pushes placement readiness score to Supabase or local SQLite."""
        student_id = score_data.get("student_id", "default_student")
        payload = {
            "student_id": student_id,
            "total_score": score_data.get("total_score", 0.0),
            "readiness_level": score_data.get("readiness_level", "Not ready"),
            "breakdown": score_data.get("breakdown", {}),
            "top_actions": score_data.get("top_actions", []),
            "raw_inputs": score_data.get("raw_inputs", {}),
            "algorithm_version": score_data.get("algorithm_version", "v1.0.0"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        if self.is_live and self.supabase:
            try:
                res = (
                    self.supabase.table("readiness_scores")
                    .upsert(payload, on_conflict="student_id")
                    .execute()
                )
                return {"success": True, "source": "supabase", "data": res.data}
            except Exception as e:
                logger.error(f"Error upserting readiness score to Supabase: {e}. Storing locally.")

        conn = sqlite3.connect(self.local_db_path)
        cur = conn.cursor()
        cur.execute(
            """
            INSERT OR REPLACE INTO readiness_scores (
                id, student_id, total_score, readiness_level, breakdown,
                top_actions, raw_inputs, algorithm_version, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?)
        """,
            (
                f"score_{student_id}",
                student_id,
                payload["total_score"],
                payload["readiness_level"],
                json.dumps(payload["breakdown"]),
                json.dumps(payload["top_actions"]),
                json.dumps(payload["raw_inputs"]),
                payload["algorithm_version"],
                payload["updated_at"],
            ),
        )
        conn.commit()
        conn.close()

        return {"success": True, "source": "local_sqlite", "student_id": student_id}

    def get_latest_mock_interview(self, student_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves the latest mock interview attempt for a student.
        AUTHORITATIVE TABLE: `mock_interview_results` (ordered by created_at DESC).
        FALLBACK TABLE: `interview_sessions` (for legacy/alternative platform sessions).
        """
        if not self.is_live or not self.supabase:
            return None

        # 1. Authoritative: mock_interview_results
        try:
            res = (
                self.supabase.table("mock_interview_results")
                .select(
                    "interview_score, technical_score, communication_score, behavioral_score, feedback_notes, strengths, weak_areas, attempt_number, created_at"
                )
                .eq("student_id", student_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if res.data and len(res.data) > 0:
                record = res.data[0]
                return {
                    "source_table": "mock_interview_results",
                    "interview_score": float(record.get("interview_score", 0.0)),
                    "technical_score": float(record.get("technical_score", 0.0)),
                    "communication_score": float(record.get("communication_score", 0.0)),
                    "behavioral_score": float(record.get("behavioral_score", 0.0)),
                    "feedback_notes": record.get("feedback_notes", ""),
                    "strengths": record.get("strengths", []),
                    "weak_areas": record.get("weak_areas", []),
                    "attempt_number": record.get("attempt_number", 1),
                }
        except Exception as e:
            logger.warning(f"Could not query mock_interview_results for {student_id}: {e}")

        # 2. Resilient Fallback: interview_sessions.result
        try:
            res = (
                self.supabase.table("interview_sessions")
                .select("result, created_at")
                .eq("student_id", student_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if res.data and len(res.data) > 0:
                session = res.data[0]
                result_obj = session.get("result") or {}
                if isinstance(result_obj, dict):
                    score = result_obj.get("interview_score") or result_obj.get("score") or 0.0
                    return {
                        "source_table": "interview_sessions",
                        "interview_score": float(score),
                        "feedback_notes": result_obj.get("feedback_notes", ""),
                        "strengths": result_obj.get("strengths", []),
                        "weak_areas": result_obj.get("weak_areas", []),
                    }
        except Exception as e:
            logger.debug(f"Fallback check on interview_sessions returned: {e}")

        return None


# Singleton instance
db_client = SupabaseHandler()
