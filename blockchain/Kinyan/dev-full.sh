#!/bin/bash
set -euo pipefail

# --- Config ---
FUND_ADDRESS="${FUND_ADDRESS:-0x1cd881C33B1F38323ED3E38e6a9850bDE58C264e}"
FUND_FILE="${FUND_FILE:-}"
FUND_ETH="${FUND_ETH:-10}"
FUND_KNY="${FUND_KNY:-5000}"
VITE_URL="${VITE_URL:-http://localhost:5173}"
BACKEND_URL="${BACKEND_URL:-http://localhost:8787}"
VITE_BACKEND_URL="${VITE_BACKEND_URL:-$BACKEND_URL}"

# Resolve project root (works no matter where you run it from)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Helpers ---
kill_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti :"$port" || true)"
    if [[ -n "${pids}" ]]; then
      echo "Killing process(es) on port ${port}: ${pids}"
      kill -9 ${pids} || true
    fi
  fi
}

wait_for_port() {
  local port="$1"
  local tries=30
  for _ in $(seq 1 $tries); do
    if command -v lsof >/dev/null 2>&1 && lsof -i :"$port" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done
  return 1
}

detect_fund_file() {
  local default_file="$ROOT_DIR/scripts/fund-wallets.json"
  if [[ -n "${FUND_FILE}" ]]; then
    return 0
  fi
  if [[ -f "${default_file}" ]]; then
    FUND_FILE="${default_file}"
  fi
}

kill_port 8545
kill_port 5173
kill_port 8787

echo "Starting Hardhat node..."
(cd "$ROOT_DIR" && npx hardhat node >/dev/null 2>&1) &
HARDHAT_PID=$!

# Wait until node is listening
if ! wait_for_port 8545; then
  echo "Hardhat node did not start on port 8545."
  exit 1
fi
echo "Hardhat node is up."

echo "Syncing chain time..."
(cd "$ROOT_DIR" && npx hardhat run scripts/sync-chain-time.js --network localhost >/dev/null 2>&1) || true

detect_fund_file

echo "Deploying contracts + exporting config..."
(cd "$ROOT_DIR" && npx hardhat run scripts/deploy-and-export.js --network localhost)

echo "Funding wallet..."
(cd "$ROOT_DIR" && FUND_FILE="$FUND_FILE" FUND_ADDRESS="$FUND_ADDRESS" FUND_ETH="$FUND_ETH" FUND_KNY="$FUND_KNY" \
  npx hardhat run scripts/fund-account.js --network localhost)

echo "Starting backend..."
if [[ ! -d "$ROOT_DIR/backend/node_modules" ]]; then
  echo "Installing backend dependencies..."
  (cd "$ROOT_DIR/backend" && npm install >/dev/null 2>&1)
fi
(cd "$ROOT_DIR/backend" && npm run dev >/dev/null 2>&1) &
BACKEND_PID=$!

# Wait until backend is listening
if ! wait_for_port 8787; then
  echo "Backend did not start on port 8787."
  exit 1
fi
echo "Backend is up."

echo "Starting frontend (Vite)..."
if [[ ! -d "$ROOT_DIR/frontend/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  (cd "$ROOT_DIR/frontend" && npm install >/dev/null 2>&1)
fi
(cd "$ROOT_DIR/frontend" && VITE_BACKEND_URL="$VITE_BACKEND_URL" npm run dev >/dev/null 2>&1) &
VITE_PID=$!

# Wait until Vite is listening
if ! wait_for_port 5173; then
  echo "Vite did not start on port 5173."
  exit 1
fi
echo "Frontend is up."

if command -v open >/dev/null 2>&1; then
  open "$VITE_URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$VITE_URL"
fi

echo ""
echo "✅ Ready"
echo " - Hardhat node: http://127.0.0.1:8545"
echo " - Frontend:     $VITE_URL"
echo " - Backend:      $BACKEND_URL"
if [[ -n "${FUND_FILE}" ]]; then
  echo " - Funded:       from file: ${FUND_FILE} (${FUND_ETH} ETH, ${FUND_KNY} KNY each)"
else
  echo " - Funded:       $FUND_ADDRESS (${FUND_ETH} ETH, ${FUND_KNY} KNY)"
fi
echo ""
echo "Press Ctrl+C to stop."

# Keep script alive; kill child processes on exit
trap "kill $HARDHAT_PID $BACKEND_PID $VITE_PID 2>/dev/null || true" EXIT
wait
