# Mock Interview Worker (Legacy Prototype)

> [!NOTE]
> **Production Notice**: This directory (`frontend-core/worker`) contains an early standalone prototype. The single authoritative, production-ready backend service and LiveKit worker is located in [`mock-interview/`](../../mock-interview), which provides unified `SessionConfig`, 15-20 min configurable timers, adaptive question banking, resilient scoring, and server-side sandboxed coding evaluation.

A Python LiveKit agent that joins interview rooms, conducts mock interviews with students via real-time audio, and sends results back to the platform.

## Architecture

```
Student microphone
  → LiveKit WebRTC
  → this worker (STT → LLM → TTS)
  → LiveKit WebRTC
  → Student speaker
```

## Quick Start

### 1. Install dependencies

```bash
cd worker
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# or: .venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

Required variables:

| Variable | Purpose |
|---|---|
| `LIVEKIT_URL` | LiveKit cloud URL (wss://) |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for DB writes) |
| `OPENAI_API_KEY` | For Whisper STT and TTS |
| `GROQ_API_KEY` | For LLM (llama-3.3-70b-versatile) and final scoring |

### 3. Run the worker

```bash
python mock_interview_worker.py
```

The worker will register with LiveKit and wait for room assignments.

## How It Works

1. **Registration**: The worker registers with LiveKit as agent `mock-interview`.
2. **Room assignment**: When the platform's Edge Function creates a room, LiveKit dispatches the worker to that room.
3. **Metadata read**: The worker reads `room.metadata` (set by the Edge Function) to get student context: name, target role, resume URL, job info, focus areas.
4. **Resume download**: If a resume URL is present, the worker downloads the PDF and extracts text using `pdfplumber`.
5. **Greeting**: The worker sends an `interview:greeting` data message and speaks a greeting.
6. **Questions**: The worker asks up to 4 questions (configurable via `MAX_QUESTIONS`). Each question is sent as an `interview:question` data message and spoken via TTS.
7. **Transcript**: Speech is transcribed and sent as `interview:transcript` data messages.
8. **Finish**: When the student clicks "Finish & Get Results" (sending `interview:finish`), or after the question limit, or after the 30-minute timeout, the worker generates results.
9. **Results**: The worker calls Groq to score the interview, sends `interview:results` data message, and persists results to the `interview_sessions` table in Supabase.
10. **Disconnect**: The worker leaves the room.

## Event Contract

### Events FROM worker TO frontend (data channel)

All messages are JSON: `{"event": "<name>", "payload": {...}}`

| Event | Payload | Description |
|---|---|---|
| `interview:greeting` | `{message: string}` | Initial greeting |
| `interview:question` | `{questionId, text, questionNumber, totalQuestions}` | New question |
| `interview:transcript` | `{speaker: "interviewer"\|"student", text, final: bool, timestamp: int}` | Transcript entry |
| `interview:results` | `{overallReadinessDelta, finalScore, summary, categoryScores[], suggestedFixes[], timestamp}` | Final results |
| `interview:error` | `{code, message}` | Error |

### Events FROM frontend TO worker (data channel)

| Event | Payload | Description |
|---|---|---|
| `interview:finish` | `{reason: "student_requested"}` | Student clicked finish |

## Configuration

Edit the constants at the top of `mock_interview_worker.py`:

| Constant | Default | Description |
|---|---|---|
| `WORKER_IDENTITY` | `mock-interview` | LiveKit agent identity |
| `MAX_QUESTIONS` | `4` | Number of questions per interview |
| `INTERVIEW_TIMEOUT_SECONDS` | `1800` (30 min) | Auto-finish timeout |
| `SILENCE_TIMEOUT_SECONDS` | `120` | Disconnect after silence |
| `SCORE_CATEGORIES` | 4 categories | Categories used for scoring |

## Database

Results are persisted to the `interview_sessions` table via Supabase REST API:

```sql
UPDATE interview_sessions
SET result = <results_json>,
    status = 'completed',
    completed_at = NOW()
WHERE id = '<interview_id>';
```

The worker uses the Supabase service role key to bypass RLS.

## Logging

All logs are sanitized — no PII, tokens, or API keys are logged. Log levels:

- `INFO`: Worker registration, room join, metadata read, greeting/question/transcript/finish/result events, DB insert success
- `WARNING`: Missing resume, missing metadata, parse errors
- `ERROR`: Connection failures, LLM errors, DB persist failures

## File Structure

```
worker/
├── mock_interview_worker.py   # Main worker script
├── requirements.txt            # Python dependencies
├── .env.example                # Environment template
└── README.md                   # This file
```
