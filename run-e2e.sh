#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
ORCHESTRATOR_LOG="$RUNTIME_DIR/orchestrator.log"
INSTALL_DEPENDENCIES=false

if [[ "${1:-}" == "--install" ]]; then
  INSTALL_DEPENDENCIES=true
elif [[ -n "${1:-}" ]]; then
  echo "Usage: ./run-e2e.sh [--install]" >&2
  exit 2
fi

mkdir -p "$RUNTIME_DIR"
rm -f "$RUNTIME_DIR/ready" "$ORCHESTRATOR_LOG"

if [[ "$INSTALL_DEPENDENCIES" == true ]]; then
  "$ROOT_DIR/start-all.sh" --install >"$ORCHESTRATOR_LOG" 2>&1 &
else
  "$ROOT_DIR/start-all.sh" >"$ORCHESTRATOR_LOG" 2>&1 &
fi
ORCHESTRATOR_PID=$!

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  if kill -0 "$ORCHESTRATOR_PID" >/dev/null 2>&1; then
    kill "$ORCHESTRATOR_PID" >/dev/null 2>&1 || true
  fi
  wait "$ORCHESTRATOR_PID" >/dev/null 2>&1 || true
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

for attempt in $(seq 1 600); do
  if [[ -f "$RUNTIME_DIR/ready" ]]; then
    break
  fi
  if ! kill -0 "$ORCHESTRATOR_PID" >/dev/null 2>&1; then
    echo "Boot sequence failed:" >&2
    cat "$ORCHESTRATOR_LOG" >&2
    exit 1
  fi
  if [[ "$attempt" == "600" ]]; then
    echo "Boot sequence timed out:" >&2
    cat "$ORCHESTRATOR_LOG" >&2
    exit 1
  fi
  sleep 1
done

cat "$ORCHESTRATOR_LOG"
(
  cd "$ROOT_DIR/mock-interview"
  INTERNAL_SERVICE_KEY="${INTERNAL_SERVICE_KEY:-e2e-internal-token}" uv run --locked python "$ROOT_DIR/scripts/e2e_simulation.py"
)
