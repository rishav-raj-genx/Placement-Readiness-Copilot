# MSOT — AI-Powered Interview Preparation

A full-stack AI interview preparation platform designed to help candidates prepare for technical and behavioral interviews with tailored practice, realistic mock sessions, and actionable feedback.

## Local setup

Copy `.env.example` to `.env.local` and set the public Supabase project
variables before using real authentication or database-backed pages:

```bash
cp .env.example .env.local
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are safe for the
browser. Server-only keys such as `SUPABASE_SERVICE_ROLE_KEY`,
`LIVEKIT_API_SECRET`, and provider API keys must never use the
`NEXT_PUBLIC_` prefix or be committed.

Without the public Supabase values, demo-mode pages still render, but real
sign-in, sign-up, and database requests remain unavailable.
