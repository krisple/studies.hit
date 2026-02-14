#!/usr/bin/env bash
set -euo pipefail

URL="${URL:-http://localhost:5173}"

wait_for_http() {
  local url="$1"
  local tries="${2:-80}"
  for _ in $(seq 1 "$tries"); do
    if curl -sS -I "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

docker compose up --build -d

echo "Waiting for UI at $URL ..."
if wait_for_http "$URL"; then
  if command -v open >/dev/null 2>&1; then
    open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL"
  else
    echo "Open this in your browser: $URL"
  fi
else
  echo "UI did not become ready in time. Check logs:"
  echo "  docker compose logs --tail=200"
  exit 1
fi

echo "✅ Running (detach mode). To stop: docker compose down"

