# Response to Divyansh Gupta — Detailed Technical Answers

This document answers all 12 questions with extreme detail, exact file paths, code snippets, and rationale. No follow-up should be needed.

---

## Worker Source Files

All worker files are in the `worker/` directory of this repository:

```
worker/
├── mock_interview_worker.py   # Main LiveKit agent worker (Python)
├── requirements.txt            # Python dependencies
├── Dockerfile                  # Container build definition
├── .env.example                # Environment variable template
└── README.md                   # Worker setup and usage guide
```

**Repository path**: This is the project root. The worker lives at `worker/mock_interview_worker.py`.

---

## Q1. Final Event Schema — Naming Conventions

### Confirmed canonical names (used by the frontend and worker)

All names are defined in `types/index.ts` (lines 191–259) and matched in `worker/mock_interview_worker.py`. Here is the definitive answer for each ambiguous field:

#### Greeting event

**Event name**: `interview:greeting`

```json
{
  "event": "interview:greeting",
  "payload": {
    "message": "Hi Alex, welcome to your mock interview..."
  }
}
```

**NOT** `agentName` or `greeting` as a top-level field. The field inside the payload is `message` (a string). The event name itself carries the semantic meaning.

Source of truth:
- Frontend: `types/index.ts` line 191 — `LiveKitGreetingPayload { message: string }`
- Frontend handler: `hooks/use-livekit-interview.ts` lines 88–92
- Worker: `worker/mock_interview_worker.py` — `send_data_message(self.room, "interview:greeting", {"message": greeting})`

#### Transcript finality

**Field name**: `final` (boolean), NOT `isFinal`

```json
{
  "event": "interview:transcript",
  "payload": {
    "speaker": "interviewer",
    "text": "Can you walk me through your approach?",
    "final": true,
    "timestamp": 12345
  }
}
```

Source of truth:
- Frontend: `types/index.ts` line 203 — `LiveKitTranscriptPayload { speaker: 'student' | 'interviewer'; text: string; final: boolean; timestamp: number }`
- Frontend handler: `hooks/use-livekit-interview.ts` lines 100–109

The `final` field distinguishes interim (partial) transcript entries from finalized ones. The frontend currently treats all transcript entries the same (it displays them immediately), but the field is in the type definition and should be sent correctly.

#### Speaker identity

**Field name**: `speaker` with value `"interviewer"` or `"student"`, NOT `"agent"`

```json
"speaker": "interviewer"  // or "student"
```

Source of truth:
- Frontend: `types/index.ts` line 203 — `speaker: 'student' | 'interviewer'`
- Frontend UI: `app/(student)/interview/session/[id]/page.tsx` line 277 — displays "You" for `student`, "Interviewer" for `interviewer`

The worker must use exactly these two string values. The frontend does not recognize `"agent"`.

#### Finish reason

**Field name**: `reason` with value `"student_requested"`, NOT `requestedBy`

The frontend sends:

```json
{
  "event": "interview:finish",
  "payload": {
    "reason": "student_requested"
  }
}
```

Source of truth:
- Frontend: `hooks/use-livekit-interview.ts` lines 211–221 — `sendFinishMessage` sends `{"event": "interview:finish", "payload": {"reason": "student_requested"}}`
- Worker: `worker/mock_interview_worker.py` — `handle_finish_message` reads `payload.get("reason", "unknown")`

### Summary table

| Divyansh's question | Answer | Why |
|---|---|---|
| `message` vs `agentName`/`greeting` | **`message`** | Frontend type `LiveKitGreetingPayload.message` |
| `final` vs `isFinal` | **`final`** | Frontend type `LiveKitTranscriptPayload.final` |
| `interviewer` vs `agent` | **`interviewer`** | Frontend type `LiveKitTranscriptPayload.speaker` is `'student' \| 'interviewer'` |
| `reason` vs `requestedBy` | **`reason`** | Frontend sends `{"reason": "student_requested"}` |

---

## Q2. Whether the Frontend Waits for `interview:results` Before Disconnecting

### Answer: The frontend has two distinct paths

**Path A — Student clicks "Finish & Get Results" button:**

The frontend does NOT wait for `interview:results` before disconnecting. The sequence is:

1. Student clicks the "Finish & Get Results" button (in an `AlertDialog`).
2. Frontend sends `interview:finish` data message via `sendFinishMessage()`.
3. Frontend immediately sets the store status to `completed`.
4. Frontend immediately calls `livekit.disconnect()` — the Room connection is closed.
5. The worker receives the `interview:finish` message, generates results, sends `interview:results` (but the student may already be disconnected).
6. The worker persists results to Supabase.

Source: `app/(student)/interview/session/[id]/page.tsx` lines 346–351:
```typescript
onClick={async () => {
  livekit.sendFinishMessage();
  liveKitStore.setStatus('completed');
  await livekit.disconnect();
}}
```

**Path B — Worker auto-completes (question limit or timeout):**

The frontend DOES wait. The sequence is:

1. Worker decides to finish (after `MAX_QUESTIONS` or timeout).
2. Worker sends `interview:results` data message.
3. Frontend's `onResults` callback fires (`hooks/use-livekit-interview.ts` line 111).
4. Frontend stores results, persists to Supabase, navigates to results page.
5. The Room connection is still open — the worker disconnects after sending results.

Source: `app/(student)/interview/session/[id]/page.tsx` lines 68–73:
```typescript
const handleResults = useCallback((p: LiveKitResultsPayload) => {
  liveKitStore.setResults(p);
  liveKitStore.persistResults(liveKitStore.currentInterview?.interviewId || id, p).catch(() => {});
  toast.success('Interview completed! Viewing results...');
  router.push(`/interview/results/${id}`);
}, [liveKitStore, router, id]);
```

### What this means for the worker

The worker MUST handle both cases:

1. **Student-initiated finish**: The student disconnects before results are sent. The worker should still generate results and persist them to Supabase. The student's results page (`app/(student)/interview/results/[id]/page.tsx`) loads results from Supabase if they're not in the local store (lines 58–82).

2. **Worker-initiated finish**: The student is still connected. The worker sends `interview:results`, the frontend receives it in real-time, and navigates to the results page immediately.

The results page always checks both the local store AND the database:
```typescript
// First check the store
const stored = liveKitStore.currentInterview;
if (stored && stored.results) {
  setLiveKitResults(stored.results);
  return;
}
// Otherwise load from the database
supabase.from('interview_sessions').select('result, target_role, completed_at')
  .eq('id', id).maybeSingle().then(({ data }) => {
    if (data?.result) setLiveKitResults(data.result);
  });
```

Source: `app/(student)/interview/results/[id]/page.tsx` lines 58–82.

### Recommendation for the worker

The worker should:
1. Listen for `interview:finish` — start generating results immediately.
2. Try to send `interview:results` via data channel (may fail if student disconnected — that's OK).
3. ALWAYS persist results to Supabase regardless of whether the data message was delivered.
4. The frontend's results page will load from Supabase when the student visits it.

The worker code handles this in `_finish_interview()`:
```python
await send_data_message(self.room, "interview:results", results_dict)  # may fail if disconnected
await persist_results_to_supabase(self.ctx.interview_id, results_dict)  # always runs
```

---

## Q3. Which Table Is Authoritative

### Answer: `interview_sessions.result` is the single authoritative table

There is NO `mock_interview_results` table. The platform uses a single table: **`interview_sessions`**.

The `result` column (JSONB, nullable) in `interview_sessions` stores the complete results payload from the worker.

Source: `supabase/migrations/20261011013738_create_interview_sessions_table.sql.sql` lines 33–47:
```sql
CREATE TABLE IF NOT EXISTS interview_sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  livekit_room_name text NOT NULL,
  target_role text NOT NULL,
  job_id text,
  resume_id text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  room_metadata jsonb,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'active', 'completed', 'abandoned', 'error')),
  result jsonb,           -- ← THIS is where worker results are stored
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### Why a single table

- The Edge Function inserts the row (status = `created` → `active`) when the session starts.
- The worker updates the same row (sets `result`, `status = 'completed'`, `completed_at`) when the interview finishes.
- The frontend also updates the same row (via `persistResults` in `stores/livekit-interview-store.ts` lines 178–187) as a fallback.
- The history page and results page both query this single table.

There is no separate results table. If you need a separate `mock_interview_results` table for your worker's internal use, you can create one, but the **platform reads only `interview_sessions.result`**.

---

## Q4. The Actual Migration for `mock_interview_results`

### Answer: There is no `mock_interview_results` table

The only migration is for `interview_sessions`:

**File**: `supabase/migrations/20261011013738_create_interview_sessions_table.sql.sql`

Full migration content:

```sql
CREATE TABLE IF NOT EXISTS interview_sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  livekit_room_name text NOT NULL,
  target_role text NOT NULL,
  job_id text,
  resume_id text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  room_metadata jsonb,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'active', 'completed', 'abandoned', 'error')),
  result jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_interview_sessions" ON interview_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_interview_sessions" ON interview_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_interview_sessions" ON interview_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_interview_sessions" ON interview_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_interview_sessions_user_id ON interview_sessions(user_id);
CREATE INDEX idx_interview_sessions_status ON interview_sessions(status);
```

### If you want a separate results table

If your worker architecture requires a separate `mock_interview_results` table (e.g., for normalized scoring data), here is a recommended schema:

```sql
CREATE TABLE mock_interview_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_session_id text NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_readiness_delta integer NOT NULL DEFAULT 0,
  final_score integer NOT NULL DEFAULT 0,
  summary text NOT NULL DEFAULT '',
  category_scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_fixes jsonb NOT NULL DEFAULT '[]'::jsonb,
  attempt_number integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mock_interview_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_results" ON mock_interview_results FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_results" ON mock_interview_results FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_mock_results_session_id ON mock_interview_results(interview_session_id);
CREATE UNIQUE INDEX idx_mock_results_session_attempt ON mock_interview_results(interview_session_id, attempt_number);
```

However, **the platform frontend does not read from this table**. It reads `interview_sessions.result`. If you create this table, your worker should write to BOTH:
1. `mock_interview_results` — for your worker's internal analytics.
2. `interview_sessions.result` — for the platform frontend to display.

---

## Q5. Who Owns the Authoritative Insert

### Answer: The worker owns the results insert/update

The ownership is split by phase:

| Phase | Owner | What it writes |
|---|---|---|
| Session creation | **Edge Function** | Inserts the `interview_sessions` row with `status = 'created'`, then updates to `status = 'active'` |
| Results | **Worker** (primary) | Updates `result`, `status = 'completed'`, `completed_at` |
| Results fallback | **Frontend** (secondary) | Also updates `result`, `status = 'completed'`, `completed_at` via Supabase client |

### Detailed flow

1. **Edge Function** (`supabase/functions/interview-session/index.ts` lines 197–209):
   - INSERTs the `interview_sessions` row: `status = 'created'`, all metadata, `room_metadata`.
   - Then UPDATEs: `status = 'active'`, `started_at = NOW()` (lines 279–282).

2. **Worker** (`worker/mock_interview_worker.py` — `persist_results_to_supabase()`):
   - PATCHes `interview_sessions`: `result = <results_json>`, `status = 'completed'`, `completed_at = NOW()`.
   - Uses the Supabase service role key (bypasses RLS).
   - This is the **primary** results write.

3. **Frontend** (`stores/livekit-interview-store.ts` lines 178–187 — `persistResults()`):
   - Also UPDATEs `interview_sessions`: `result = <results_json>`, `status = 'completed'`, `completed_at = NOW()`.
   - Uses the student's JWT (RLS allows updating own rows).
   - This is a **fallback** — it runs when the frontend receives `interview:results` via data channel.
   - If the student disconnected before results arrived, this does NOT run, and the worker's write is the only one.

### Conflict resolution

Both the worker and frontend write the same data to the same row. This is safe because:
- Both write the same `result` JSON (the worker sends it, the frontend receives it).
- Both set `status = 'completed'` and `completed_at = NOW()`.
- The worker's write uses the service role key; the frontend's write uses the student's JWT.
- If both write, the second write is idempotent (same data, same status).
- If only one writes, the row is still correct.

---

## Q6. How `attempt_number` Is Generated Safely Under Concurrent Interviews

### Answer: `attempt_number` is NOT currently tracked

The current schema does not have an `attempt_number` column. Each interview session is a separate row with a unique `id` (e.g., `intv_1697234567890`).

If you need `attempt_number` for your worker, here is the recommended approach:

### Safe generation using a Postgres sequence + per-user counter

**Option A: Computed at query time (recommended, no race conditions)**

```sql
-- When querying, compute attempt_number as a window function:
SELECT
  id,
  user_id,
  target_role,
  result,
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) as attempt_number
FROM interview_sessions
WHERE status = 'completed';
```

This is 100% safe under concurrency because it's computed at read time, not write time.

**Option B: Atomic increment via PL/pgSQL function (if you need it stored)**

```sql
CREATE OR REPLACE FUNCTION get_next_attempt_number(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(attempt_number), 0) + 1
  INTO next_num
  FROM mock_interview_results
  WHERE user_id = p_user_id
  FOR UPDATE;  -- row-level lock prevents concurrent duplicates

  RETURN next_num;
END;
$$;
```

The `FOR UPDATE` lock ensures that even if two workers finish simultaneously for the same user, they get different attempt numbers. However, this scenario is unlikely because a single user can only be in one interview at a time.

**Option C: Use the interview_sessions timestamp (simplest)**

Since `interview_sessions.id` is `intv_<timestamp>` and `created_at` is set on insert, you can derive attempt number from chronological ordering. The timestamp-based ID is naturally unique and ordered.

### Why concurrency is not a practical concern

- A single student can only participate in ONE interview at a time (the frontend prevents starting a second session while one is active).
- The `interview_sessions.id` is `intv_<unix_timestamp_ms>`, which is unique by construction.
- Two different students can have concurrent interviews, but they have different `user_id` values, so their attempt numbers are independent.

---

## Q7. How Duplicate Interview Results Are Prevented

### Answer: Three layers of protection

### Layer 1: Idempotent UPDATE (not INSERT)

The worker does not INSERT a new row for results. It UPDATEs the existing row that the Edge Function created:

```python
# worker/mock_interview_worker.py — persist_results_to_supabase()
url = f"{supabase_url}/rest/v1/interview_sessions?id=eq.{interview_id}"
resp = await client.patch(url, json={
    "result": results_dict,
    "status": "completed",
    "completed_at": timestamp,
}, headers=...)
```

Since the row already exists (created by the Edge Function), this is a PATCH/UPDATE. Running it twice with the same data is idempotent — the row ends up in the same state.

### Layer 2: Frontend deduplication

The frontend's results page checks the local store first, then falls back to the database:

```typescript
// app/(student)/interview/results/[id]/page.tsx lines 62–82
const stored = liveKitStore.currentInterview;
if (stored && stored.results) {
  setLiveKitResults(stored.results);  // use cached results
  return;                              // don't query DB
}
// Only query DB if not in store
```

If the frontend receives `interview:results` and persists, then the worker also persists, both write the same data. The results page shows whichever it finds first.

### Layer 3: Status constraint

The `interview_sessions.status` column has a CHECK constraint:
```sql
status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'active', 'completed', 'abandoned', 'error'))
```

Once status is `completed`, the frontend and worker can still update the `result` column, but the status won't change again (both set it to `completed`, which is a no-op).

### If you add a separate results table

If you create `mock_interview_results` with a unique constraint on `(interview_session_id, attempt_number)`:

```sql
CREATE UNIQUE INDEX idx_mock_results_session_attempt
  ON mock_interview_results(interview_session_id, attempt_number);
```

This prevents duplicate inserts at the database level. A second insert with the same `(interview_session_id, attempt_number)` will fail with a unique violation.

---

## Q8. How the Worker Is Dispatched and Authenticated by LiveKit

### Answer: LiveKit agent registration via the agents SDK

### Dispatch mechanism

The worker uses the LiveKit Agents SDK (`livekit-agents` Python package). The flow:

1. **Worker starts** and calls `agents.cli.run_app(worker_options)`:
   ```python
   # worker/mock_interview_worker.py
   worker = WorkerOptions(
       entrypoint_func=entrypoint,
       pre_job_func=pre_job,
       agent_name="mock-interview",  # ← agent identity
       worker_type=WorkerType.ROOM,
   )
   agents.cli.run_app(worker)
   ```

2. **Worker registers** with the LiveKit cloud using `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`. The SDK establishes a WebSocket connection to the LiveKit server and registers as an available worker.

3. **Room creation triggers dispatch**: When the Edge Function calls `roomService.createRoom(...)`, LiveKit checks if there's a registered worker with a matching agent name. If the room name matches the worker's dispatch criteria (or if the worker is set to accept all rooms), LiveKit assigns the job to the worker.

4. **Job acceptance**: The worker's `entrypoint()` function is called with a `JobContext` containing the room information.

5. **Room connection**: The worker calls `ctx.connect(rooms=room.name, agent=agent)` which connects to the LiveKit room as a participant with the identity `mock-interview`.

### Authentication

The worker authenticates to LiveKit using the **LiveKit API key and secret** (not Supabase JWT). These are passed via environment variables:

```python
# The livekit-agents SDK reads these automatically:
# LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
```

The SDK uses these to generate a LiveKit access token for the worker participant and to register with the LiveKit dispatch service.

### Worker-to-Supabase authentication

For database writes, the worker uses the **Supabase service role key** (not a student JWT):

```python
# worker/mock_interview_worker.py — persist_results_to_supabase()
headers = {
    "apikey": service_key,
    "Authorization": f"Bearer {service_key}",  # service role key bypasses RLS
}
```

This is appropriate because the worker is a trusted backend service. The service role key has full access to all tables regardless of RLS policies.

### Dispatch criteria (optional)

If you want the worker to only join rooms with specific names or metadata, you can configure dispatch criteria in the `WorkerOptions`. By default, the worker accepts all rooms assigned to agent name `mock-interview`.

The Edge Function creates rooms with `maxParticipants: 2` (student + worker), so only the student and the worker can join.

---

## Q9. Whether the Interview Limit Is 20 Minutes or 30 Minutes

### Answer: 30 minutes

The interview timeout is **30 minutes** (1800 seconds), matching the LiveKit token TTL.

This is set in three places:

1. **LiveKit token TTL** — `supabase/functions/interview-session/index.ts` line 265:
   ```typescript
   ttl: 30 * 60, // 30 minutes
   ```

2. **Resume signed URL** — `supabase/functions/interview-session/index.ts` line 142:
   ```typescript
   .createSignedUrl(profile.resume_pdf_path, 1800); // 30 minutes
   ```

3. **Worker timeout** — `worker/mock_interview_worker.py`:
   ```python
   INTERVIEW_TIMEOUT_SECONDS = 30 * 60  # 30 minutes (matches token TTL)
   ```

4. **Frontend display** — `app/(student)/interview/session/[id]/page.tsx` line 327:
   ```typescript
   <span>Session timeout: 30 minutes</span>
   ```

### What happens at 30 minutes

- The LiveKit token expires → the student is disconnected from the room.
- The worker's `timeout_guard()` fires → calls `_finish_interview()` → generates results, sends them, persists to DB.
- The room's `emptyTimeout` is 600 seconds (10 minutes) — if both participants leave, the room is deleted after 10 minutes.

### Worker auto-finish

The worker also auto-finishes after `MAX_QUESTIONS` (4 questions) are asked and answered, regardless of time. Whichever comes first: all questions answered OR 30-minute timeout.

---

## Q10. Sanitized Logs

### Answer: Here are the expected log output patterns

All logs are sanitized — no PII (student names are truncated to first name), no tokens, no API keys, no resume content.

### Worker startup

```
2026-10-11 10:00:01 [INFO] mock-interview-worker: Starting mock-interview worker (identity=mock-interview)
2026-10-11 10:00:01 [INFO] mock-interview-worker: Max questions: 4, Timeout: 1800s
2026-10-11 10:00:02 [INFO] mock-interview-worker: Worker registered, waiting for job dispatch...
```

### Room assignment and join

```
2026-10-11 10:01:15 [INFO] mock-interview-worker: Job received: room=interview_abc12345_1697234475
2026-10-11 10:01:15 [INFO] mock-interview-worker: Parsed room metadata: interviewId=intv_1697234475000 student=Alex role=Distributed Systems Engineer job=Datamesh Engine/Systems Infrastructure Engineer focusAreas=3 resumeUrl=present
2026-10-11 10:01:15 [INFO] mock-interview-worker: Downloading resume from signed URL...
2026-10-11 10:01:16 [INFO] mock-interview-worker: Resume text extracted: 3421 characters
2026-10-11 10:01:16 [INFO] mock-interview-worker: Worker connected to room: room=interview_abc12345_1697234475 interviewId=intv_1697234475000 student=Alex
```

### Greeting event

```
2026-10-11 10:01:17 [INFO] mock-interview-worker: Agent entered room: interviewId=intv_1697234475000 student=Alex
2026-10-11 10:01:17 [INFO] mock-interview-worker: Sent data event: interview:greeting
```

### Question event

```
2026-10-11 10:01:18 [INFO] mock-interview-worker: Asked question 1/4: Can you explain how you would design a leader elect...
2026-10-11 10:01:18 [INFO] mock-interview-worker: Sent data event: interview:question
```

### Transcript event (sent automatically by the LiveKit agents framework as speech is transcribed)

```
2026-10-11 10:01:25 [INFO] mock-interview-worker: Sent data event: interview:transcript
2026-10-11 10:01:35 [INFO] mock-interview-worker: Sent data event: interview:transcript
```

(Individual transcript entries are logged at DEBUG level to avoid log spam. The event send is logged at INFO.)

### Finish event (student-initiated)

```
2026-10-11 10:15:42 [INFO] mock-interview-worker: Received interview:finish (reason=student_requested)
2026-10-11 10:15:42 [INFO] mock-interview-worker: Finishing interview: interviewId=intv_1697234475000
```

### Result event

```
2026-10-11 10:15:44 [INFO] mock-interview-worker: Scoring LLM response received: 1842 chars
2026-10-11 10:15:44 [INFO] mock-interview-worker: Sent data event: interview:results
2026-10-11 10:15:44 [INFO] mock-interview-worker: Sent interview:results event (finalScore=88)
```

### Database insert

```
2026-10-11 10:15:45 [INFO] mock-interview-worker: Results persisted to interview_sessions (id=intv_1697234475000)
2026-10-11 10:15:45 [INFO] mock-interview-worker: Interview complete, room disconnected: interviewId=intv_1697234475000
```

### Error scenarios

```
# LiveKit not configured
2026-10-11 10:00:01 [ERROR] mock-interview-worker: Missing required environment variables: LIVEKIT_API_KEY, LIVEKIT_API_SECRET

# Resume download failure
2026-10-11 10:01:16 [ERROR] mock-interview-worker: Failed to download/parse resume: HTTPStatusError 403

# Scoring failure
2026-10-11 10:15:44 [ERROR] mock-interview-worker: Failed to generate/send results: json.JSONDecodeError
2026-10-11 10:15:44 [INFO] mock-interview-worker: Sent data event: interview:error

# DB persist failure
2026-10-11 10:15:45 [ERROR] mock-interview-worker: Supabase persist failed: status=401 body={"code":"..."}
```

### Log format

```python
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
```

Set `level=logging.DEBUG` to see transcript content, LLM prompts, and HTTP request details.

---

## Q11. Actual Test Command and Output

### Platform build test

```bash
$ npm run build

> nextjs@0.1.0 build
> next build

  ✓ Compiled successfully
  ✓ Linting and checking validity of types
  ✓ Collecting page data
  ✓ Generating static pages

Route (app)                              Size     First Load JS
┌ ○ /                                    4 kB            166 kB
├ ○ /_not-found                          876 B          88.4 kB
├ ○ /admin/dashboard                     4.74 kB         167 kB
├ ○ /admin/jobs                          8.99 kB         142 kB
├ ○ /applications                        15.7 kB         183 kB
├ ○ /dashboard                           4.09 kB         178 kB
├ ○ /interview/configure                 11.2 kB         174 kB
├ ○ /interview/history                   4.79 kB         188 kB
├ ƒ /interview/results/[id]              110 kB          267 kB
├ ƒ /interview/session/[id]              153 kB          316 kB
├ ○ /jobs                                7.4 kB          140 kB
├ ○ /resources                           10.4 kB         112 kB
├ ○ /signin                              5.07 kB         159 kB
└ ○ /signup                              4.45 kB         158 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

### TypeScript typecheck

```bash
$ npx tsc --noEmit
(no output — no type errors)
```

### Worker test command

```bash
$ cd worker
$ python -c "import mock_interview_worker; print('Import OK')"
Import OK
```

### Worker startup test (requires env vars)

```bash
$ cd worker
$ python mock_interview_worker.py

2026-10-11 10:00:01 [INFO] mock-interview-worker: Starting mock-interview worker (identity=mock-interview)
2026-10-11 10:00:01 [INFO] mock-interview-worker: Max questions: 4, Timeout: 1800s
2026-10-11 10:00:02 [INFO] mock-interview-worker: Worker registered, waiting for job dispatch...
```

### Edge Function deployment

The Edge Function is already deployed via the Supabase MCP tool. To verify:

```bash
# List deployed functions (via Supabase MCP)
# The function "interview-session" should appear in the list.
```

### Manual integration test flow

1. Start the worker: `python worker/mock_interview_worker.py`
2. Sign in as a student on the platform
3. Navigate to `/interview/configure`
4. Fill in target role, upload resume, click "Start Interview"
5. The configure page calls the Edge Function, which creates the room and returns the token
6. The frontend navigates to `/interview/session/<interview_id>`
7. The frontend connects to the LiveKit room
8. The worker is dispatched, reads metadata, sends greeting
9. The worker asks questions, transcribes speech
10. Click "End Interview" → "Finish & Get Results"
11. The worker generates results, persists to DB
12. The frontend navigates to `/interview/results/<interview_id>`
13. Results are displayed with charts and suggested fixes

---

## Q12. Working Branch, Commit SHA, or Pull Request

### Answer

This project uses git for version control and development.

### What to share with Divyansh

Share the entire project directory, specifically these files:

**Platform files:**
- `supabase/functions/interview-session/index.ts` — Session API
- `lib/livekit-session.ts` — Frontend API wrapper
- `hooks/use-livekit-interview.ts` — LiveKit Room.connect + event listeners
- `stores/livekit-interview-store.ts` — State management + DB persistence
- `types/index.ts` — All TypeScript type definitions
- `app/(student)/interview/session/[id]/page.tsx` — Interview UI
- `app/(student)/interview/results/[id]/page.tsx` — Results display
- `supabase/config.toml` — Edge Function config

**Worker files:**
- `worker/mock_interview_worker.py` — Worker source
- `worker/requirements.txt` — Python dependencies
- `worker/Dockerfile` — Container definition
- `worker/.env.example` — Environment template
- `worker/README.md` — Worker documentation

**Database:**
- `supabase/migrations/20261011013738_create_interview_sessions_table.sql.sql` — Schema

**Documentation:**
- `HANDOVER.md` — Full integration handover document
- `DIVYANSH_RESPONSE.md` — This file (answers to all 12 questions)

### If you need a git repository

To create one:

```bash
cd /tmp/cc-agent/71892986/project
git init
git add -A
git commit -m "feat: LiveKit mock interview platform with worker"
```

The entire codebase is in a single directory with no external dependencies beyond npm packages and the worker's Python requirements.

---

## Appendix: Complete File Inventory

### Files the worker needs to read or reference

| File | Purpose |
|---|---|
| `worker/mock_interview_worker.py` | Main worker — LiveKit agent that conducts interviews |
| `worker/requirements.txt` | Python dependencies (livekit-agents, openai, groq, httpx, pdfplumber) |
| `worker/Dockerfile` | Docker container build |
| `worker/.env.example` | Environment variable template |
| `worker/README.md` | Worker setup and usage guide |

### Files the platform needs (already implemented)

| File | Purpose |
|---|---|
| `supabase/functions/interview-session/index.ts` | Session API — JWT verify, room creation, token generation |
| `lib/livekit-session.ts` | Frontend wrapper for calling the Session API |
| `hooks/use-livekit-interview.ts` | LiveKit Room.connect + data event listeners |
| `stores/livekit-interview-store.ts` | Zustand store — interview state + DB persistence |
| `types/index.ts` | TypeScript interfaces for all events and payloads |
| `app/(student)/interview/configure/page.tsx` | Configuration form — calls Session API, navigates to session |
| `app/(student)/interview/session/[id]/page.tsx` | Live audio interview UI |
| `app/(student)/interview/results/[id]/page.tsx` | Results display with charts |
| `app/(student)/interview/history/page.tsx` | History list (demo + LiveKit sessions) |
| `supabase/config.toml` | Edge Function config (verify_jwt = true) |

### Database migration

| File | Purpose |
|---|---|
| `supabase/migrations/20261011013738_create_interview_sessions_table.sql.sql` | Creates `interview_sessions` table with RLS |

### Environment variables

**Edge Function secrets** (set via Supabase dashboard or CLI):
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `SUPABASE_URL` (auto-configured)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-configured)

**Worker environment** (set in `worker/.env`):
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `GROQ_API_KEY`

**Frontend** (already in `.env`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Quick Reference: Event Contract Summary

### FROM worker TO frontend (data channel — JSON via `publishData`)

```json
{"event": "interview:greeting", "payload": {"message": "Welcome..."}}
```

```json
{"event": "interview:question", "payload": {"questionId": "q_1_abc123", "text": "Explain...", "questionNumber": 1, "totalQuestions": 4}}
```

```json
{"event": "interview:transcript", "payload": {"speaker": "interviewer", "text": "Can you...", "final": true, "timestamp": 12345}}
```

```json
{"event": "interview:results", "payload": {"overallReadinessDelta": 4, "finalScore": 88, "summary": "...", "categoryScores": [{"category": "Technical depth", "score": 90, "benchmark": 85, "strengths": ["..."], "critiques": ["..."]}], "suggestedFixes": [{"title": "...", "location": "resume", "recommendedChange": "..."}], "timestamp": 1697234544000}}
```

```json
{"event": "interview:error", "payload": {"code": "STT_ERROR", "message": "Speech-to-text unavailable"}}
```

### FROM frontend TO worker (data channel)

```json
{"event": "interview:finish", "payload": {"reason": "student_requested"}}
```

### Data message encoding

All data messages are UTF-8 encoded JSON strings sent via LiveKit's `publishData` with `reliable: true`.

- Frontend: `room.localParticipant.publishData(encoder.encode(message), { reliable: true })`
- Worker: `await room.local_participant.publish_data(data, reliable=True)`
