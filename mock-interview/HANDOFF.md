# Mock Interview Handoff

## Open questions for teammates

- (a) What is the exact resume JSON shape, and where does it live in Supabase?
- (b) Does Rituraj read `mock_interview_results.interview_score` directly?
- (c) How does Divyansh pass the student JWT and ID?

These questions are intentionally non-blocking. The implementation currently
uses fixture resumes, `InterviewContext`, and draft contract version `v0`.
When the real format arrives, change only `agent/context_adapter.py` and
`scoring/schemas.py`, bump `contract_version`, and re-run the fixture tests.

## LiveKit project configuration

The provisional worker is configured for project `p_11cdaf29hpo` at
`wss://interviewxai-owtcvxdw.livekit.cloud`, with agent name
`mock-interview`. API keys and secrets must be supplied through environment
variables or the deployment secret manager, not committed to this repository.

The FastAPI websocket now expects `auth_token` and optional `student_id` on
`start`. The token subject is the authoritative student identity. Supabase
result persistence expects a `mock_interview_results` table with columns for
`student_id`, `attempt_number`, `interview_score`, `technical_score`,
`communication_score`, `behavioral_score`, `strengths`, `weak_areas`,
`feedback_notes`, `transcript`, `mode`, `duration_minutes`, and `created_at`.
The internal `contract_version` remains in API results but is not persisted
because it is not a column in the confirmed table.

Divyansh's frontend/API contract uses an HTTP `Authorization: Bearer <token>`
header for `POST /api/interview/session`; the backend must derive identity from
JWT `sub` and treat body `studentId` as advisory. LiveKit room metadata follows
the nested `student`, `resume`, and `job` shape in the handoff attachment.
Frontend LiveKit data events use the `interview:greeting`,
`interview:question`, `interview:transcript`, `interview:results`, and
`interview:error` namespaced event names.

Divyansh confirmed that the platform shell owns `POST /api/interview/session`,
`POST /api/interview/finish`, room creation, metadata injection, LiveKit token
minting, and the frontend `Room.connect` integration. The worker consumes the
metadata established before the student joins. Finish requests arrive as a
reliable `interview:finish` data packet and the platform also calls the finish
API for cleanup.

## Confirmed platform-shell contract

The platform handoff specifies:

- Session creation is a Supabase Edge Function at
  `supabase/functions/interview-session`.
- The platform uses `interview_sessions.result` as its authoritative result
  record.
- The worker reads `room.metadata`, including the nested `student`, `resume`,
  `job`, `focusAreas`, and `config` fields.
- The maximum interview duration is 30 minutes.
- Canonical event fields are `message` for greetings, `questionId`/`text`/
  `questionNumber` for questions, `final` plus `interviewer`/`student` for
  transcript turns, and `reason: "student_requested"` for finish messages.
- The frontend currently disconnects immediately after sending finish; the
  worker must persist results even when the data-channel result cannot be
  delivered.

The platform handoff also says room creation may update metadata when a room
already exists. That fallback must be restricted to a verified,
same-interview room; all other room-creation failures must fail closed before
token generation.

The standalone `scoring/result_store.py` remains a provisional adapter for
Rituraj's separate `mock_interview_results` proposal. It is not the
authoritative persistence path for the platform-shell interview until the team
resolves that schema conflict.

`SupabaseInterviewSessionStore` in `scoring/result_store.py` now implements the
platform-shell persistence path by PATCHing the validated result into
`interview_sessions.result` and marking the session completed. The standalone
`SupabaseResultStore` remains available only for the separate provisional
`mock_interview_results` schema.

The persisted v0 transcript shape uses `speaker: "ai" | "student"` and
`timestamp_sec`. The LiveKit wire event intentionally keeps the frontend
transport names `interviewer` and `student`; the persistence schema and wire
event schema are separate boundaries.
