#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/app"

wait_for_http() {
  local url="$1"
  local tries="${2:-60}"
  for _ in $(seq 1 "$tries"); do
    if curl -sS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

wait_for_rpc() {
  local tries=60
  for _ in $(seq 1 $tries); do
    if curl -sS -H "Content-Type: application/json" \
      --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
      http://127.0.0.1:8545 >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

cleanup() {
  kill "${HARDHAT_PID:-}" "${BACKEND_PID:-}" "${VITE_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT

echo "Starting Hardhat node..."
(cd "$ROOT_DIR" && npx hardhat node --hostname 0.0.0.0 --port 8545) &
HARDHAT_PID=$!

if ! wait_for_rpc; then
  echo "Hardhat node did not start on port 8545."
  exit 1
fi
echo "Hardhat node is up."

echo "Syncing chain time..."
(cd "$ROOT_DIR" && npx hardhat run scripts/sync-chain-time.js --network localhost) || true

echo "Deploying contracts + exporting config..."
(cd "$ROOT_DIR" && npx hardhat run scripts/deploy-and-export.js --network localhost)

echo "Funding wallets (ETH + KNY)..."
# Uses scripts/fund-wallets.json by default; you can override via FUND_FILE env.
(cd "$ROOT_DIR" && FUND_FILE="${FUND_FILE:-$ROOT_DIR/scripts/fund-wallets.json}" \
  FUND_ETH="${FUND_ETH:-10}" FUND_KNY="${FUND_KNY:-5000}" \
  npx hardhat run scripts/fund-account.js --network localhost)

echo "Starting backend..."
(cd "$ROOT_DIR/backend" && npm run dev) &
BACKEND_PID=$!

if ! wait_for_http "http://127.0.0.1:8787/api/health"; then
  echo "Backend did not start on port 8787."
  exit 1
fi
echo "Backend is up."

echo "Starting frontend (Vite)..."
(cd "$ROOT_DIR/frontend" && npm run dev -- --host 0.0.0.0 --port 5173) &
VITE_PID=$!

if ! wait_for_http "http://127.0.0.1:5173"; then
  echo "Frontend did not start on port 5173."
  exit 1
fi
echo "Frontend is up."

echo ""
echo "✅ Kinyan Docker Demo Ready"
echo " - Hardhat RPC:  http://localhost:8545  (chainId 31337)"
echo " - Backend API:  http://localhost:8787  (try /api/health)"
echo " - Frontend:     http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop."

wait
