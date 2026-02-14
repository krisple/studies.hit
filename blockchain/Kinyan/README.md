# Kinyan — Blockchain Final Project

Kinyan is a full-stack blockchain demo:
- Hardhat local blockchain + contracts (SongNFT + KNY + Marketplace)
- Backend (`backend/`) that generates `metadata.json` from a Spotify link and pins it to IPFS via Pinata
- Frontend (`frontend/`) React + Vite + web3.js (MetaMask)

## Recommended: Run with Docker

### Prerequisites
- Docker Desktop installed and running

### Setup (one-time)
1) Create `backend/.env` from `backend/.env.example` and fill:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `PINATA_JWT`

2) Add the wallets you want to fund (ETH + KNY) to:
   - `scripts/fund-wallets.json`

Example:
```json
{ "addresses": ["0x...", "0x..."] }
```

### Run
```bash
./docker-up.sh
```

Open:
- Frontend: `http://localhost:5173`
- Hardhat RPC (MetaMask): `http://localhost:8545` (chainId `31337`)
- Backend health: `http://localhost:8787/api/health`

Notes:
- On startup, Docker automatically deploys contracts and runs `scripts/fund-account.js` using `scripts/fund-wallets.json`.
 - If you prefer foreground logs: `docker compose up --build`

## Run without Docker (local dev)

### Prerequisites
- Node.js (recommended v20+)
- npm

### Run
```bash
./dev-full.sh
```

This starts:
- Hardhat node (`8545`)
- Backend (`8787`)
- Frontend (`5173`)

## Common workflow (UI)
1) Connect MetaMask to the local Hardhat network (RPC `http://localhost:8545`, chainId `31337`).
2) Register tab: paste Spotify URL → Generate → registerSong.
3) Profile tab: see your assets → list for sale / edit / remove.
4) Market tab: see active offers → purchase.
