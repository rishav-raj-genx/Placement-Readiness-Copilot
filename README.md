# Hireable

Integrated development environment for the Next.js frontend and three Python
services: profile review, mock interview, and readiness/job automation.

## One-command E2E setup

Requirements: Node.js, `pnpm`, Python 3.12+, and `uv`.

```bash
./run-e2e.sh --install
```

This installs locked dependencies, starts all four services, uploads the dummy
PDF, runs a six-question text interview, calculates the seven-component
readiness score, fetches five compliant job matches, prints the JSON report,
and shuts every service down. A successful run ends with `SYSTEM READY`.

After dependencies are installed, use:

```bash
./run-e2e.sh
```

## Boot all services

```bash
./start-all.sh
```

The boot command runs until interrupted and stops all child processes on exit.
Logs are written under `.runtime/logs/`.

| Service | URL | Port |
| --- | --- | ---: |
| Frontend | http://127.0.0.1:3000 | 3000 |
| Profile review | http://127.0.0.1:8001 | 8001 |
| Mock interview | ws://127.0.0.1:8002/ws/interview | 8002 |
| Automation worker | http://127.0.0.1:8003 | 8003 |

`start-all.sh` checks every port before booting and reports the owning process
when a conflict exists. It also verifies the frontend integration health route,
which calls all three backend health endpoints.

## E2E versus live providers

The scripts default to `E2E_MODE=true`. In this mode the profile review uses its
static benchmark evaluator, the interview uses deterministic text-only
providers, and job discovery uses five permitted-source fixtures. The complete
HTTP/WebSocket contracts and readiness mathematics still execute.

For provider-backed operation:

```bash
E2E_MODE=false PROFILE_LLM_PROVIDER=groq ./start-all.sh
```

Live operation requires the keys documented in each service's `.env.example`,
including Groq, Deepgram, LiveKit, and Supabase. Service-role credentials must
remain server-side. Without Supabase configuration, readiness results use the
documented local SQLite fallback and the response reports `local_sqlite`.
