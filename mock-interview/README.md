# Mock Interview Voice Service

This is a standalone websocket service for a 30-minute maximum mock interview.
The transport is deliberately independent of the frontend so a LiveKit
component can proxy or wrap it without coupling the interview state machine to
React.

## Run locally

```bash
cd mock-interview
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export GROQ_API_KEY=...
export DEEPGRAM_API_KEY=...
uvicorn app:create_app --factory --reload
```

The service exposes `GET /health` and `WS /ws/interview`.

## LiveKit worker

The native LiveKit Agents worker is [`livekit_worker.py`](./livekit_worker.py).
It uses the current `AgentServer`/`AgentSession` entrypoint pattern and reads
the provisional resume payload from LiveKit room metadata. Run it with Python
3.10+:

```bash
cp .env.example .env.local
# Fill .env.local locally; never commit it.
pip install -r livekit-requirements.txt
lk agent dev
```

Configured LiveKit project:

- Project ID: `p_11cdaf29hpo`
- WebSocket URL: `wss://interviewxai-owtcvxdw.livekit.cloud`
- Agent name: `mock-interview`
- SIP URI: `sip:11cdaf29hpo.sip.livekit.cloud`

The SIP URI is reserved for a later phone-interview integration; the current
browser flow uses WebRTC rooms.

The worker uses LiveKit Inference with Deepgram STT, Groq LLM, and Deepgram
Aura TTS. Set the corresponding LiveKit/provider credentials in the
environment; never commit them to the repository.

## Websocket protocol

Start with a fixture-shaped resume:

```json
{"event":"start","auth_token":"<supabase-access-token>","student_id":"<jwt-sub>","resume":{"name":"Asha","target_role":"Backend Engineer","skills":["Python"]}}
```

The websocket verifies the Supabase JWT (`sub`, `aud`, and `exp`) and requires
`student_id` to match the token subject. The token is never returned or logged.
Set `SUPABASE_JWT_SECRET`, `SUPABASE_URL`, and
`SUPABASE_SERVICE_ROLE_KEY` in the server environment. The service role key is
server-only. For the platform-shell integration, `interview_sessions.result` is
the authoritative result record; the standalone provisional store for
`mock_interview_results` should not be used for the same platform interview.

For platform sessions, use `SupabaseInterviewSessionStore` to PATCH the
validated result into `interview_sessions.result`. It marks the session
`completed` and records `completed_at`. Do not use the provisional
`SupabaseResultStore` for the same session.

The persistence mapping follows the confirmed table: `interview_score` is
stored as the top-level score, `technical_depth`, `communication`, and
`behavioral` dimensions map to their numeric score columns, improvement areas
map to `weak_areas`, the summary maps to `feedback_notes`, and the full
transcript is stored as JSONB. `attempt_number`, `mode`, and
`duration_minutes` are also written. The internal `contract_version` remains
part of the API result; the current table does not contain a corresponding
column.

For the platform-shell session API, use the standard HTTP header
`Authorization: Bearer <supabase-access-token>` and derive the student ID from
JWT `sub`; the request-body `studentId` is advisory only. The LiveKit room
metadata adapter accepts the nested `student`, `resume`, and `job` payload
shape used by the platform shell.

For browser text input:

```json
{"event":"answer","text":"I built a reliable API."}
```

For microphone audio, send base64-encoded audio:

```json
{"event":"audio_answer","audio_base64":"...","content_type":"audio/webm"}
```

Finish and receive the validated `InterviewResult`:

```json
{"event":"finish"}
```

On finish, the validated result is persisted before the result event is sent
to the client. Persistence failures produce an explicit error and do not
pretend the interview was saved.

Each greeting/question response contains `text` and base64-encoded Deepgram
Aura audio. Provider failures are returned as an explicit `error` event; the
service never silently substitutes an unscored result.

The exact result schema is documented in [`CONTRACT.md`](./CONTRACT.md), which
is generated from [`scoring/schemas.py`](./scoring/schemas.py).

The persisted v0 result uses `ai` and `student` transcript speakers with
`timestamp_sec`, and stores dimension details under `dimensions`. The
LiveKit data-channel payloads follow the latest platform-shell contract:
`interview:greeting` uses `message`, `interview:question` uses `questionId`,
`text`, `questionNumber`, and `totalQuestions`,
`interview:transcript` uses `speaker` (`interviewer` or `student`), `final`,
and `timestamp`, and `interview:results` uses `finalScore`,
`categoryScores`, and `suggestedFixes`. A student finish message uses
`{"event":"interview:finish","payload":{"reason":"student_requested"}}`.

LiveKit references:

- https://docs.livekit.io/agents/start/voice-ai/
- https://docs.livekit.io/agents/logic/sessions/
- https://github.com/livekit/agents/blob/main/examples/voice_agents/basic_agent.py
