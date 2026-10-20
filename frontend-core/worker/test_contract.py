#!/usr/bin/env python3
"""
Test Suite: Mock Interview LiveKit Worker & Contract Validation
==============================================================
Validates:
1. Canonical v0 JSONB schema for interview_sessions.result
2. interview_score rules (0-100, float/decimal, top-level, v0 contract_version)
3. Transcript boundary conversion (speaker 'ai'/'student', timestamp_sec)
4. Dimensions completeness (technical_depth, communication, behavioral)
5. Frontend event contracts (greeting, question, transcript, results, error, finish)
6. Room metadata parsing
"""

import unittest
import json
import time

from mock_interview_worker import (
    TranscriptEntry,
    InterviewContext,
    parse_room_metadata,
    build_canonical_v0_result,
    validate_canonical_v0_result,
    build_frontend_results_event,
)


class TestCanonicalV0Contract(unittest.TestCase):
    def setUp(self):
        self.sample_transcript = [
            TranscriptEntry("interviewer", "Hello, welcome to the mock interview.", 0.2),
            TranscriptEntry("student", "Hi, glad to be here.", 4.8),
            TranscriptEntry("interviewer", "Explain event-driven microservices.", 12.1),
            TranscriptEntry("student", "In an event-driven system, services communicate via asynchronous events.", 24.6),
        ]
        self.sample_raw_llm = {
            "interview_score": 78.5,
            "ai_confidence": 0.82,
            "overallReadinessDelta": 3,
            "summary": "Solid technical depth in full-stack architecture.",
            "dimensions": {
                "technical_depth": {
                    "score": 80.0,
                    "feedback": "Strong understanding of distributed architectures.",
                    "strengths": ["Event driven patterns", "Decoupling"],
                    "improvement_areas": ["Idempotency handling"]
                },
                "communication": {
                    "score": 75.0,
                    "feedback": "Clear answers with good pace.",
                    "strengths": ["Structured replies"],
                    "improvement_areas": ["Be more concise"]
                },
                "behavioral": {
                    "score": 80.0,
                    "feedback": "Professional tone and high confidence.",
                    "strengths": ["Composure under questioning"],
                    "improvement_areas": []
                }
            },
            "categoryScores": [
                {
                    "category": "Technical depth",
                    "score": 80.0,
                    "benchmark": 70,
                    "strengths": ["Event driven patterns"],
                    "critiques": ["Idempotency handling"]
                }
            ],
            "suggestedFixes": [
                {
                    "title": "Idempotency in consumer handlers",
                    "location": "answers",
                    "recommendedChange": "Mention deduplication keys when discussing Kafka consumers."
                }
            ]
        }

    def test_canonical_v0_result_structure(self):
        canonical = build_canonical_v0_result(self.sample_raw_llm, self.sample_transcript)
        valid, msg = validate_canonical_v0_result(canonical)
        self.assertTrue(valid, f"Validation failed: {msg}")

        # 1. Top-level contract_version
        self.assertEqual(canonical["contract_version"], "v0")

        # 2. Top-level interview_score
        self.assertIsInstance(canonical["interview_score"], float)
        self.assertEqual(canonical["interview_score"], 78.5)
        self.assertGreaterEqual(canonical["interview_score"], 0)
        self.assertLessEqual(canonical["interview_score"], 100)

        # Scoring confidence drives the faculty review queue.
        self.assertEqual(canonical["ai_confidence"], 0.82)

        # 3. Summary
        self.assertEqual(canonical["summary"], "Solid technical depth in full-stack architecture.")

        # 4. Dimensions
        self.assertIn("dimensions", canonical)
        dims = canonical["dimensions"]
        self.assertIn("technical_depth", dims)
        self.assertIn("communication", dims)
        self.assertIn("behavioral", dims)

        for dim_name in ("technical_depth", "communication", "behavioral"):
            d = dims[dim_name]
            self.assertIn("score", d)
            self.assertIn("feedback", d)
            self.assertIn("strengths", d)
            self.assertIn("improvement_areas", d)
            self.assertIsInstance(d["score"], float)

        # 5. Transcript boundary conversion
        t = canonical["transcript"]
        self.assertEqual(len(t), 4)
        # First entry: interviewer -> ai, timestamp_sec -> 0
        self.assertEqual(t[0]["speaker"], "ai")
        self.assertEqual(t[0]["timestamp_sec"], 0)
        self.assertEqual(t[0]["text"], "Hello, welcome to the mock interview.")
        # Second entry: student -> student, timestamp_sec -> 5
        self.assertEqual(t[1]["speaker"], "student")
        self.assertEqual(t[1]["timestamp_sec"], 5)
        self.assertEqual(t[1]["text"], "Hi, glad to be here.")

    def test_invalid_contract_version_rejected(self):
        canonical = build_canonical_v0_result(self.sample_raw_llm, self.sample_transcript)
        canonical["contract_version"] = "v1"
        valid, msg = validate_canonical_v0_result(canonical)
        self.assertFalse(valid)
        self.assertIn("contract_version must be 'v0'", msg)

    def test_interview_score_bounds(self):
        canonical = build_canonical_v0_result(self.sample_raw_llm, self.sample_transcript)
        canonical["interview_score"] = 150.0
        valid, msg = validate_canonical_v0_result(canonical)
        self.assertFalse(valid)
        self.assertIn("interview_score must be between 0 and 100", msg)

    def test_missing_score_is_rejected(self):
        raw = dict(self.sample_raw_llm)
        raw.pop("interview_score")
        with self.assertRaises(ValueError):
            build_canonical_v0_result(raw, self.sample_transcript)

    def test_confidence_bounds(self):
        raw = dict(self.sample_raw_llm)
        raw["ai_confidence"] = 1.2
        with self.assertRaises(ValueError):
            build_canonical_v0_result(raw, self.sample_transcript)

    def test_missing_dimension_is_rejected_before_persistence(self):
        raw = json.loads(json.dumps(self.sample_raw_llm))
        del raw["dimensions"]["behavioral"]
        with self.assertRaises(ValueError):
            build_canonical_v0_result(raw, self.sample_transcript)

    def test_missing_dimension_rejected(self):
        canonical = build_canonical_v0_result(self.sample_raw_llm, self.sample_transcript)
        del canonical["dimensions"]["behavioral"]
        valid, msg = validate_canonical_v0_result(canonical)
        self.assertFalse(valid)
        self.assertIn("dimensions must contain 'behavioral'", msg)

    def test_frontend_event_results_shape(self):
        canonical = build_canonical_v0_result(self.sample_raw_llm, self.sample_transcript)
        event_payload = build_frontend_results_event(self.sample_raw_llm, canonical)

        self.assertEqual(event_payload["finalScore"], 78.5)
        self.assertEqual(event_payload["overallReadinessDelta"], 3)
        self.assertEqual(event_payload["summary"], "Solid technical depth in full-stack architecture.")
        self.assertIsInstance(event_payload["categoryScores"], list)
        self.assertIsInstance(event_payload["suggestedFixes"], list)
        self.assertIsInstance(event_payload["timestamp"], int)


class TestRoomMetadataContract(unittest.TestCase):
    def test_room_metadata_parsing(self):
        sample_meta = json.dumps({
            "interviewId": "intv_1791859000",
            "student": {
                "id": "uuid-student-1234",
                "name": "Divyansh",
                "email": "divyansh@example.com",
                "targetRole": "Full-Stack Engineer"
            },
            "resume": {
                "parsedText": "React, TypeScript, Next.js, Python, PostgreSQL",
                "keySkills": ["React", "Python"],
                "pdfUrl": "https://example.com/resume.pdf"
            },
            "job": {
                "title": "Senior Frontend Engineer",
                "company": "Tech Corp",
                "minimumThresholdScore": 75
            },
            "focusAreas": ["System Design", "Architecture"],
            "config": {
                "targetRole": "Full-Stack Engineer"
            }
        })

        ctx = parse_room_metadata(sample_meta)
        self.assertEqual(ctx.interview_id, "intv_1791859000")
        self.assertEqual(ctx.student_id, "uuid-student-1234")
        self.assertEqual(ctx.student_name, "Divyansh")
        self.assertEqual(ctx.target_role, "Full-Stack Engineer")
        self.assertEqual(ctx.job_title, "Senior Frontend Engineer")
        self.assertEqual(ctx.job_company, "Tech Corp")
        self.assertEqual(ctx.job_threshold_score, 75)
        self.assertEqual(ctx.focus_areas, ["System Design", "Architecture"])
        self.assertEqual(ctx.resume_pdf_url, "https://example.com/resume.pdf")


if __name__ == "__main__":
    unittest.main()
