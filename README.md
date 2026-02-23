# PR AI Review (Bitbucket Server) – Full Project (Backend + Frontend)

This repository contains:
- `backend/`: Node.js (TypeScript) Express API, in-memory sessions (Option A), Bitbucket Server/DC integration, auto-delete after meta review.
- `frontend/`: Next.js UI with 2 screens (Intake + Review).

## Quick start (dev)

### 1) Backend
```bash
cd backend
npm install
cp .env .env
# edit .env (Bitbucket Server base url + token)
npm run dev
```
Backend runs on: `http://localhost:3000`

### 2) Frontend
```bash
cd ../frontend
npm install
cp .env .env
# ensure NEXT_PUBLIC_API_BASE_URL points to backend (default ok)
npm run dev
```
Frontend runs on: `http://localhost:3001`

## Notes
- Sessions are kept **only in memory** and deleted after successful meta review (`deleteAfter=true`).
- A TTL cleanup deletes abandoned sessions (default 60 minutes).
- LLM calls are stubbed in `backend/src/llm.ts`. Replace with real OpenAI calls when ready.
- Diff endpoint currently returns the full PR diff. You can later split per file server-side.
