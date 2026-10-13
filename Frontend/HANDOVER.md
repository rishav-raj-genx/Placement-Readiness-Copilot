# Mock Interview Platform — Backend & LiveKit Integration Handover

This document answers every technical question from Divyansh Gupta, with exact file paths, request/response formats, and code references so the LiveKit worker can be connected to the platform.

---

## 1. Platform Repository and Files

All files are in this repository. Here are the exact paths for each requested component:

| Requested Component | File Path |
|---|---|
| Session API (POST /api/interview/session) | `supabase/functions/interview-session/index.ts` |
| Supabase authentication/session handling | `lib/livekit-session.ts` (frontend) + `supabase/functions/interview-session/index.ts` (backend) |
| Resume fetching logic | `supabase/functions/interview-session/index.ts` (lines 130–151, fetches from Supabase private storage) |
| LiveKit room creation and token generation | `supabase/functions/interview-session/index.ts` (lines 237–276) |
| Frontend Room.connect(...) implementation | `hooks/use-livekit-interview.ts` (lines 147–193) |
| LiveKit data-channel event listeners | `hooks/use-livekit-interview.ts` (lines 82–126) |
| Supabase client initialization | `lib/supabase-client.ts` |
| Type definitions for all events/payloads | `types/index.ts` (lines 156–259) |
| State management (interview store) | `stores/livekit-interview-store.ts` |
| Session page (LiveKit UI) | `app/(student)/interview/session/[id]/page.tsx` |
| Results page (displays worker results) | `app/(student)/interview/results/[id]/page.tsx` |
| Configure page (starts the session) | `app/(student)/interview/configure/page.tsx` |
| History page (lists all sessions) | `app/(student)/interview/history/page.tsx` |

---

## 2. Session API Request and Response

### Endpoint

The Session API is deployed as a Supabase Edge Function:

```
POST {NEXT_PUBLIC_SUPABASE_URL}/functions/v1/interview-session
```

File: `supabase/functions/interview-session/index.ts`

### Request Headers

```
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
apikey: <supabase-anon-key>
```

The frontend sends these headers in `lib/livekit-session.ts` (lines 20–28). The Supabase access token is obtained from `supabase.auth.getSession()`.

### Request Body

```json
{
  "studentId": "optional-client-value",
  "targetRole": "Distributed Systems Engineer",
  "jobId": "job-01",
  "resumeId": "res_alex_chen_v2",
  "topics": ["Concurrency and leader election", "Latency trade-offs"],
  "difficulty": "adaptive",
  "durationMinutes": 30,
  "experienceLevel": "three_plus",
  "companyType": "product_based",
  "targetCompany": "Datamesh Engine",
  "customInstructions": "Focus on system design",
  "focusAreas": ["Concurrency and leader election", "Latency trade-offs"]
}
```

All fields except `targetRole` are optional. `studentId` is an optional consistency check only.

### JWT Verification (Backend)

File: `supabase/functions/interview-session/index.ts` (lines 64–112)

1. Extracts the Bearer token from the Authorization header.
2. Calls `serviceClient.auth.getUser(accessToken)` to verify the JWT.
3. Uses `userData.user.id` (the JWT `sub` claim) as the **authoritative student ID** (`jwtUserId`).
4. If `body.studentId` is provided and does not match `jwtUserId`, returns 403.
5. The body `studentId` is **never trusted as the primary identity**.

### Response (Success — 200)

```json
{
  "serverUrl": "wss://interviewxai-owtcvxdw.livekit.cloud",
  "roomName": "interview_<student-id-prefix>_<timestamp>",
  "token": "<livekit-access-token>",
  "interviewId": "intv_<timestamp>"
}
```

- `serverUrl`: The LiveKit server URL from the `LIVEKIT_URL` environment variable.
- `roomName`: Format is `interview_<first-8-chars-of-uuid>_<timestamp>`.
- `token`: A LiveKit JWT access token for the student participant.
- `interviewId`: Format is `intv_<timestamp>`.

### Response (Error)

```json
{
  "error": "Human-readable error message",
  "interviewId": "intv_..."  // included only for LiveKit-not-configured errors
}
```

Error codes: 401 (invalid token), 403 (studentId mismatch), 400 (missing targetRole), 404 (profile not found), 503 (LiveKit not configured), 500 (internal error).

### Frontend Validation

File: `lib/livekit-session.ts` (lines 37–39)

The frontend validates that the response contains all four fields (`serverUrl`, `roomName`, `token`, `interviewId`) before returning.

---

## 3. LiveKit Room Metadata

### Which Backend Creates the Room

The Supabase Edge Function (`supabase/functions/interview-session/index.ts`) creates the LiveKit room using the LiveKit Server SDK's `RoomServiceClient`.

### Which Backend Sets the Metadata

The same Edge Function sets the room metadata at room creation time (line 244–248).

### Metadata Is Set Before the Student Joins

**Yes.** The sequence is:

1. Edge Function creates the room with metadata via `roomService.createRoom({ name, metadata, emptyTimeout, maxParticipants })` (line 244).
2. Edge Function generates the student token (line 261).
3. Edge Function returns the token to the frontend.
4. Frontend calls `room.connect(serverUrl, token)` — the student joins the room **after** the room and metadata already exist.

If room creation fails (e.g., room already exists), the function falls back to `roomService.updateRoomMetadata(roomName, metadataJson)` (line 254).

### Metadata Structure

File: `supabase/functions/interview-session/index.ts` (lines 43–50, 180–192)

```json
{
  "interviewId": "intv_9823482",
  "student": {
    "id": "student-uuid",
    "name": "Alexandre Chen",
    "email": "alex@example.com",
    "targetRole": "Distributed Systems Engineer"
  },
  "resume": {
    "parsedText": "Resume reference: res_alex_chen_v2",
    "keySkills": [],
    "pdfUrl": "https://<supabase-project>.supabase.co/storage/v1/object/sign/candidate-documents/...?token=..."
  },
  "job": {
    "title": "Systems Infrastructure Engineer",
    "company": "Datamesh Engine",
    "minimumThresholdScore": 85
  },
  "focusAreas": [
    "Concurrency and leader election",
    "Latency trade-offs",
    "Failure modes"
  ],
  "config": {
    "targetRole": "Distributed Systems Engineer",
    "jobId": "job-01",
    "difficulty": "adaptive",
    "durationMinutes": 30,
    "focusAreas": ["Concurrency and leader election", "Latency trade-offs"],
    "..."
  }
}
```

Notes:
- `job` is `null` if no `jobId` was provided in the request.
- `resume.pdfUrl` is a **short-lived signed URL** (valid for 30 minutes) that the worker can use to download the resume PDF from Supabase private storage.
- `resume.parsedText` currently contains a reference string if `resumeId` was provided. The worker should download the PDF from `pdfUrl` and parse it.
- `resume.keySkills` is currently empty — the worker should extract skills from the downloaded PDF.

### Worker Should Use `room.metadata` as the Source of Truth

**Yes.** The worker should read `room.metadata` when it joins the room. This contains all the context needed: student profile, resume URL, job info, focus areas, and the original configuration.

---

## 4. LiveKit Token Permissions

File: `supabase/functions/interview-session/index.ts` (lines 260–276)

The student token is generated with these permissions:

```typescript
livekitToken.addGrant({
  room: roomName,
  roomJoin: true,
  canPublish: true,
  canSubscribe: true,
  canPublishData: true,
});
```

- `roomJoin`: true
- `canPublish`: true (student can publish audio)
- `canSubscribe`: true (student can hear the worker)
- `canPublishData`: true (student can send data messages like `interview:finish`)
- `ttl`: 30 minutes (30 * 60 seconds)
- `identity`: `student_<jwtUserId>`
- `name`: The student's display name from their profile
- `metadata`: `{"interviewId":"intv_...","role":"student"}`

### Worker Agent Name

The worker should join the room with identity `mock-interview`. The platform does not generate a token for the worker — the worker should generate its own token using the LiveKit API key/secret, or join using a pre-generated token.

---

## 5. Frontend LiveKit Event Contract

File: `hooks/use-livekit-interview.ts` (lines 82–126)

The frontend listens for these exact data-channel events via `RoomEvent.DataReceived`:

| Event Name | Payload Type | Description |
|---|---|---|
| `interview:greeting` | `LiveKitGreetingPayload` | Initial greeting from the interviewer |
| `interview:question` | `LiveKitQuestionPayload` | A new question is asked |
| `interview:transcript` | `LiveKitTranscriptPayload` | A transcript entry (student or interviewer speech) |
| `interview:results` | `LiveKitResultsPayload` | Final interview results |
| `interview:error` | `LiveKitErrorPayload` | An error occurred during the interview |

### Expected Payload Schemas

All payloads are sent as JSON: `{ "event": "<event-name>", "payload": { ... } }`

The data is sent as a UTF-8 encoded `Uint8Array` via LiveKit's data channel. The frontend decodes it with `TextDecoder` and parses the JSON.

#### `interview:greeting`

```json
{
  "event": "interview:greeting",
  "payload": {
    "message": "Hi Alex, welcome to your mock interview..."
  }
}
```

#### `interview:question`

```json
{
  "event": "interview:question",
  "payload": {
    "questionId": "q_1",
    "text": "Can you explain how you would design a leader election algorithm?",
    "questionNumber": 1,
    "totalQuestions": 4
  }
}
```

#### `interview:transcript`

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

`speaker` is either `"interviewer"` or `"student"`. `final` indicates whether this is a final transcript (vs. interim). `timestamp` is in milliseconds relative to the interview start.

#### `interview:results`

File: `types/index.ts` (lines 223–230)

```json
{
  "event": "interview:results",
  "payload": {
    "overallReadinessDelta": 4,
    "finalScore": 88,
    "summary": "Overall interview feedback...",
    "categoryScores": [
      {
        "category": "Technical depth",
        "score": 90,
        "benchmark": 85,
        "strengths": ["Strong understanding of Raft consensus"],
        "critiques": ["Could elaborate more on failure modes"]
      }
    ],
    "suggestedFixes": [
      {
        "title": "Improve quantified impact",
        "location": "resume",
        "recommendedChange": "Add measurable outcomes..."
      }
    ],
    "timestamp": 0
  }
}
```

#### `interview:error`

```json
{
  "event": "interview:error",
  "payload": {
    "code": "STT_ERROR",
    "message": "Speech-to-text service unavailable"
  }
}
```

### No Additional Fields Required

The frontend does not require any additional fields beyond what is defined above. The results payload is fully rendered by the `LiveKitResultsView` component in `app/(student)/interview/results/[id]/page.tsx`.

---

## 6. Interview Completion Flow

File: `hooks/use-livekit-interview.ts` (lines 211–221) and `app/(student)/interview/session/[id]/page.tsx` (lines 330–358)

### Frontend Finish Action

There is a **"Finish & Get Results" button** in the session UI. When clicked, it:

1. Sends a LiveKit data message: `{ "event": "interview:finish", "payload": { "reason": "student_requested" } }` via `room.localParticipant.publishData()` with `reliable: true`.
2. Sets the interview status to `completed` in the local store.
3. Disconnects from the LiveKit room.

The worker should listen for this data message and generate final results when received.

### Automatic Completion

The worker can also auto-complete the interview:
- After the configured question limit is reached.
- After a timeout (the token expires in 30 minutes, and the room has a 10-minute empty timeout).

When the worker auto-completes, it should send the `interview:results` event. The frontend will automatically navigate to the results page when results are received.

### Results Persistence

When the frontend receives `interview:results`, it:
1. Saves results to the local store.
2. Persists results to the `interview_sessions` table in Supabase (`stores/livekit-interview-store.ts`, lines 178–187) — updates the `result` column and sets `status = 'completed'` and `completed_at`.
3. Navigates to the results page.

---

## 7. Frontend Audio Flow

### The Frontend Uses Native LiveKit WebRTC (Option A)

```
Frontend microphone
  → LiveKit room (WebRTC)
  → LiveKit worker (STT/LLM/TTS)
  → LiveKit audio response
  → Frontend speaker
```

File: `hooks/use-livekit-interview.ts`

- **Microphone**: Enabled immediately after connecting via `room.localParticipant.setMicrophoneEnabled(true)` (line 182).
- **Connection**: `room.connect(serverUrl, token)` (line 179) — uses LiveKit WebRTC.
- **Room options**: `adaptiveStream: true, dynacast: true` (lines 162–164).
- **Speaker audio**: Subscribed automatically by LiveKit — the worker's audio track is played through the browser's audio output.
- **Speaking indicator**: The frontend listens to `RoomEvent.ActiveSpeakersChanged` to detect when the interviewer is speaking.

The FastAPI websocket audio endpoint is **not used**. All audio flows through LiveKit WebRTC.

---

## 8. Required Implementation Files

| Requested File | Path | Purpose |
|---|---|---|
| Session API | `supabase/functions/interview-session/index.ts` | JWT verification, profile/resume fetch, room creation, token generation, DB record |
| LiveKit token generation | `supabase/functions/interview-session/index.ts` (lines 237–276) | Uses `livekit-server-sdk` AccessToken |
| LiveKit room metadata creation | `supabase/functions/interview-session/index.ts` (lines 240–258) | RoomServiceClient.createRoom with metadata |
| Room.connect(...) | `hooks/use-livekit-interview.ts` (lines 147–193) | Connects to LiveKit room with token |
| RoomEvent.DataReceived | `hooks/use-livekit-interview.ts` (lines 82–126, 167) | Parses data-channel messages |
| Supabase session/token access | `lib/livekit-session.ts` (lines 10–16) | Gets access_token from supabase.auth.getSession() |
| Resume retrieval | `supabase/functions/interview-session/index.ts` (lines 130–151) | Fetches from profiles table, creates signed URL from private storage |
| Type definitions | `types/index.ts` (lines 156–259) | All LiveKit event/payload TypeScript interfaces |
| State management | `stores/livekit-interview-store.ts` | Zustand store for interview state, result persistence |

---

## Database Schema

File: `supabase/migrations/20261011013738_create_interview_sessions_table.sql.sql`

### `interview_sessions` table

| Column | Type | Description |
|---|---|---|
| `id` | `text` PK | Interview ID (e.g., `intv_9823482`) |
| `user_id` | `uuid` | References `auth.users.id` |
| `livekit_room_name` | `text` | LiveKit room name |
| `target_role` | `text` | Target job role |
| `job_id` | `text` | Optional job reference |
| `resume_id` | `text` | Optional resume reference |
| `config` | `jsonb` | Full session configuration |
| `room_metadata` | `jsonb` | Full room metadata (student, resume, job, focus areas) |
| `result` | `jsonb` | Final results from the worker (nullable) |
| `status` | `text` | `created` → `active` → `completed` |
| `started_at` | `timestamptz` | When the session was activated |
| `completed_at` | `timestamptz` | When results were saved |
| `created_at` | `timestamptz` | Auto-set on insert |

### RLS Policies

- Students can only SELECT, INSERT, UPDATE, and DELETE their own sessions (filtered by `auth.uid() = user_id`).

---

## Edge Function Configuration

File: `supabase/config.toml`

```toml
[functions.interview-session]
verify_jwt = true
entrypoint = "./functions/interview-session/index.ts"
```

`verify_jwt = true` ensures Supabase validates the JWT before the function runs.

---

## Environment Variables / Secrets

### Required Edge Function Secrets

These must be set as Supabase Edge Function secrets (not in `.env`):

| Secret Name | Purpose |
|---|---|
| `LIVEKIT_URL` | LiveKit server URL (e.g., `wss://interviewxai-owtcvxdw.livekit.cloud`) |
| `LIVEKIT_API_KEY` | LiveKit API key for room creation and token generation |
| `LIVEKIT_API_SECRET` | LiveKit API secret for room creation and token generation |
| `SUPABASE_URL` | Auto-configured by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-configured by Supabase |

### Frontend Environment Variables

These are in `.env` and are public:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

---

## What Divyansh Needs to Do

1. **Set LiveKit secrets** on the edge function: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

2. **Worker joins the room** with identity `mock-interview` (or any identity — the frontend detects non-local participants as the interviewer).

3. **Worker reads `room.metadata`** on join — this JSON string contains the student profile, resume PDF URL, job info, and focus areas.

4. **Worker downloads resume** from the signed URL in `room.metadata.resume.pdfUrl` (valid for 30 minutes).

5. **Worker sends data messages** with the exact event names and payload schemas defined in section 5 above.

6. **Worker listens for `interview:finish`** data messages from the student to know when to generate results.

7. **Worker sends `interview:results`** when the interview is complete (either after student finishes, after question limit, or after timeout).

8. **No secrets should be shared in chat** — all API keys and secrets are managed through Supabase's secret manager.

---

## File Summary for Quick Reference

```
supabase/functions/interview-session/index.ts   → Session API (JWT, room, token, metadata, DB)
lib/livekit-session.ts                           → Frontend fetch wrapper for the Session API
hooks/use-livekit-interview.ts                   → LiveKit Room.connect + event listeners
stores/livekit-interview-store.ts                → Zustand store for interview state + DB persistence
types/index.ts                                   → TypeScript interfaces for all payloads
app/(student)/interview/configure/page.tsx       → Configuration form, calls Session API
app/(student)/interview/session/[id]/page.tsx    → Live audio interview UI
app/(student)/interview/results/[id]/page.tsx    → Results display (charts, scores, suggested fixes)
app/(student)/interview/history/page.tsx         → History list (both demo and LiveKit sessions)
supabase/config.toml                             → Edge function config (verify_jwt = true)
supabase/migrations/20261011013738_*.sql         → Database schema for interview_sessions
```
