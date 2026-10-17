#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
LOG_DIR="$RUNTIME_DIR/logs"
READY_FILE="$RUNTIME_DIR/ready"
PID_FILE="$RUNTIME_DIR/pids"

FRONTEND_PORT="${FRONTEND_PORT:-3000}"
PROFILE_PORT="${PROFILE_PORT:-8001}"
INTERVIEW_PORT="${INTERVIEW_PORT:-8002}"
AUTOMATION_PORT="${AUTOMATION_PORT:-8003}"
E2E_MODE="${E2E_MODE:-true}"
INSTALL_DEPENDENCIES=false

if [[ "${1:-}" == "--install" ]]; then
  INSTALL_DEPENDENCIES=true
elif [[ -n "${1:-}" ]]; then
  echo "Usage: ./start-all.sh [--install]" >&2
  exit 2
fi

for command_name in pnpm uv curl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
done

if [[ "$INSTALL_DEPENDENCIES" == true ]]; then
  pnpm --dir "$ROOT_DIR/frontend-core" install --frozen-lockfile
  (cd "$ROOT_DIR/profile-review-api" && uv sync --locked --dev)
  (cd "$ROOT_DIR/mock-interview" && uv sync --locked --dev)
  (cd "$ROOT_DIR/automation-and-job-discovery" && uv sync --locked --dev)
  (cd "$ROOT_DIR/automation-and-job-discovery" && uv run --locked playwright install chromium)
fi

check_port() {
  local service_name="$1"
  local port="$2"
  local owner=""

  if command -v lsof >/dev/null 2>&1; then
    owner="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$owner" ]]; then
      echo "PORT CONFLICT: $service_name requires port $port" >&2
      echo "$owner" >&2
      return 1
    fi
    return 0
  fi

  if ! uv run --no-project python - "$port" <<'PY'
import socket
import sys

port = int(sys.argv[1])
with socket.socket() as client:
    raise SystemExit(1 if client.connect_ex(("127.0.0.1", port)) == 0 else 0)
PY
  then
    echo "PORT CONFLICT: $service_name requires port $port" >&2
    return 1
  fi
}

check_port "frontend" "$FRONTEND_PORT"
check_port "profile-review" "$PROFILE_PORT"
check_port "mock-interview" "$INTERVIEW_PORT"
check_port "automation" "$AUTOMATION_PORT"

mkdir -p "$LOG_DIR"
rm -f "$READY_FILE" "$PID_FILE"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

PIDS=()
NAMES=()

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
  for pid in "${PIDS[@]:-}"; do
    wait "$pid" >/dev/null 2>&1 || true
  done
  rm -f "$READY_FILE" "$PID_FILE"
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

(
  cd "$ROOT_DIR/profile-review-api"
  exec env LLM_PROVIDER="${PROFILE_LLM_PROVIDER:-static}" \
    uv run --locked python -m uvicorn main:app \
    --host 127.0.0.1 --port "$PROFILE_PORT"
) >"$LOG_DIR/profile-review.log" 2>&1 &
PIDS+=("$!")
NAMES+=("profile-review")

(
  cd "$ROOT_DIR/mock-interview"
  exec env MOCK_INTERVIEW_E2E_MODE="$E2E_MODE" \
    uv run --locked python -m uvicorn app:create_runtime_app --factory \
    --host 127.0.0.1 --port "$INTERVIEW_PORT"
) >"$LOG_DIR/mock-interview.log" 2>&1 &
PIDS+=("$!")
NAMES+=("mock-interview")

(
  cd "$ROOT_DIR/automation-and-job-discovery"
  exec env AUTOMATION_E2E_MODE="$E2E_MODE" \
    uv run --locked python -m uvicorn src.api.server:app \
    --host 127.0.0.1 --port "$AUTOMATION_PORT"
) >"$LOG_DIR/automation.log" 2>&1 &
PIDS+=("$!")
NAMES+=("automation")

(
  cd "$ROOT_DIR/frontend-core"
  exec env \
    PROFILE_REVIEW_API_URL="http://127.0.0.1:$PROFILE_PORT/health" \
    MOCK_INTERVIEW_API_URL="http://127.0.0.1:$INTERVIEW_PORT/health" \
    AUTOMATION_API_URL="http://127.0.0.1:$AUTOMATION_PORT/" \
    pnpm dev --hostname 127.0.0.1 --port "$FRONTEND_PORT"
) >"$LOG_DIR/frontend.log" 2>&1 &
PIDS+=("$!")
NAMES+=("frontend")

for index in "${!PIDS[@]}"; do
  printf '%s %s\n' "${NAMES[$index]}" "${PIDS[$index]}" >>"$PID_FILE"
done

wait_for_health() {
  local service_name="$1"
  local url="$2"
  local log_file="$3"
  local attempt

  for attempt in $(seq 1 90); do
    if curl --silent --show-error --fail --max-time 3 "$url" >/dev/null 2>&1; then
      echo "READY: $service_name ($url)"
      return 0
    fi
    sleep 1
  done

  echo "STARTUP ERROR: $service_name did not become healthy at $url" >&2
  tail -n 40 "$log_file" >&2 || true
  return 1
}

wait_for_health "profile-review" "http://127.0.0.1:$PROFILE_PORT/health" "$LOG_DIR/profile-review.log"
wait_for_health "mock-interview" "http://127.0.0.1:$INTERVIEW_PORT/health" "$LOG_DIR/mock-interview.log"
wait_for_health "automation" "http://127.0.0.1:$AUTOMATION_PORT/" "$LOG_DIR/automation.log"
wait_for_health "frontend" "http://127.0.0.1:$FRONTEND_PORT/" "$LOG_DIR/frontend.log"
wait_for_health \
  "frontend integration route" \
  "http://127.0.0.1:$FRONTEND_PORT/api/health" \
  "$LOG_DIR/frontend.log"

touch "$READY_FILE"
echo "All services are running. Logs: $LOG_DIR"
echo "E2E mode: $E2E_MODE"

while true; do
  for index in "${!PIDS[@]}"; do
    if ! kill -0 "${PIDS[$index]}" >/dev/null 2>&1; then
      echo "SERVICE EXITED: ${NAMES[$index]}" >&2
      tail -n 40 "$LOG_DIR/${NAMES[$index]}.log" >&2 || true
      exit 1
    fi
  done
  sleep 2
done
