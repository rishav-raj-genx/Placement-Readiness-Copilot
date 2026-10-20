# Hireable frontend

Next.js 14 student workspace for evidence-backed profile review, placement readiness, AI interviews, job discovery, and application tracking.

## Runtime architecture

- Next.js `14.2.35`, React 18, strict TypeScript, Tailwind CSS, Framer Motion, and Zustand.
- Supabase Auth uses `@supabase/ssr` cookie synchronization. Middleware validates sessions with `getUser()`; it does not decode JWTs locally.
- Supabase PostgreSQL stores profiles, review state, readiness scores, interviews, jobs, and applications.
- Private `candidate-documents` storage keeps `<user-id>/resume.pdf` and `<user-id>/linkedin.pdf`.
- Next.js server routes proxy the profile-review and automation services. Browser components do not call FastAPI directly.
- LiveKit session creation retains the existing Supabase Edge Function contract.

## Student flow

1. `/signin` and `/signup` forward to the split-canvas `/auth` experience. Email confirmations return through `/auth/callback`.
2. Incomplete student profiles are gated behind `/auth?mode=signup&resume=1`; admins are not affected. `/onboarding` is a compatibility redirect.
3. The three-step signup collects account identity, target role, GitHub ID, and the required Resume and LinkedIn PDFs. Non-secret fields and pending documents are restored after email confirmation; profile completion is written only after both uploads succeed.
4. `/dashboard` starts or shows asynchronous analysis and renders seven weighted readiness components. Missing evidence is displayed as **Not assessed**.
5. `/review` shows Resume, GitHub, LinkedIn, and Live Link findings.
6. `/jobs` combines matched jobs, exact-source `MSOT Admin` jobs, and the accessible DnD Kit tracker. `/applications` redirects to `/jobs?tab=tracker`.
7. `/dashboard/interview` reuses the unified profile and defaults to 15 minutes. The live room uses wall-clock countdown timing, audio levels, mic/speaker controls, and a transcript drawer.

## Environment

Copy `.env.example` to `.env.local` and set the values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<jwt-secret>

NEXT_PUBLIC_LIVEKIT_URL=wss://<project>.livekit.cloud
LIVEKIT_API_KEY=<api-key>
LIVEKIT_API_SECRET=<api-secret>

PROFILE_REVIEW_API_URL=http://127.0.0.1:8001/health
INTERVIEW_SERVICE_URL=http://127.0.0.1:8002/health
AUTOMATION_API_URL=http://127.0.0.1:8003
```

`PROFILE_REVIEW_API_URL` may point to the service base or `/health`; server code normalizes it to the base URL. Service-role and LiveKit secrets must never use a `NEXT_PUBLIC_` prefix.

## Database migration

Apply migrations in filename order through the Supabase CLI or dashboard SQL editor. The redesign migration is:

```text
supabase/migrations/20261019000000_unified_onboarding_and_reviews.sql
```

It adds unified profile fields and the server-written `candidate_profile_reviews` table. The UI stores the private LinkedIn PDF path and does not collect a public LinkedIn URL.

## Local commands

Run from `frontend-core`:

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run the repository integration workflow from the repository root:

```bash
./run-e2e.sh --install
```

That workflow proves the deterministic local four-service simulation. It does not prove live Supabase storage/auth, external job providers, or LiveKit audio.

## Server routes

- `POST /api/profile-review/analyze` authenticates the student, downloads owned PDFs, invokes profile review, checks project links, calculates readiness, and persists both states.
- `POST /api/jobs/discover` submits the authenticated profile role, locations, and skills to automation.
- `POST /api/projects/check` verifies project ownership before checking one stored live URL.
- `GET /auth/callback` exchanges confirmation codes and routes users without open redirects.
