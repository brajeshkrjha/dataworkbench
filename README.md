# DataWorkbench

FastAPI backend + Next.js frontend for a catalog of data engineering tools. Backend exposes a tool registry via REST API; frontend consumes it through a generated TypeScript API contract.

## Prerequisites

- Python 3.11+
- Node.js 20.9+ (Next.js 16 / React 19)
- npm

## Project Structure

```
backend/    FastAPI app (app/), tests, OpenAPI export script
frontend/   Next.js app (src/), generated API types
```

## Backend Setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

> If PowerShell blocks `Activate.ps1` due to execution policy, invoke `.venv\Scripts\python.exe` directly instead of activating.

For development, install [backend/requirements-dev.txt](backend/requirements-dev.txt)
instead; it includes runtime dependencies and the pinned backend linter. Use the
Python executable from your selected virtual environment when running checks.

## Frontend Setup

```powershell
cd frontend
npm install
```

## Environment Configuration

**Backend** (`backend/.env`, optional — copy from `.env.example`): settings are prefixed with `DWB_`.

```
DWB_DEBUG=true
```

Other supported vars (defaults work for local dev): `DWB_ENVIRONMENT`, `DWB_CORS_ORIGINS`, `DWB_APP_NAME`, `DWB_APP_VERSION`, `DWB_API_V1_PREFIX`.

**Frontend** (`frontend/.env.local`, required):

```
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8010/api/v1
```

## Running the Application

**Backend** (port `8010`):

```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8010
```

**Frontend** (port `3000`):

```powershell
cd frontend
npm run dev
```

## Verify Setup

- Backend health: `http://127.0.0.1:8010/api/v1/health` → `{"status":"ok",...}`
- Backend tools: `http://127.0.0.1:8010/api/v1/tools`
- Frontend: `http://localhost:3000`

## Deploying to Vercel

Deploy as **two Vercel projects** from the same repo.

1. **Backend**: import the repo, set *Root Directory* to `backend` (entrypoint: `backend/index.py`). Env vars:
   - `DWB_ENVIRONMENT=production`
   - `DWB_DEBUG=false`
   - `DWB_CORS_ORIGINS=["https://<frontend-domain>.vercel.app"]` (JSON list)
2. **Frontend**: import the repo, set *Root Directory* to `frontend`. Env var:
   - `NEXT_PUBLIC_API_BASE_URL=https://<backend-domain>.vercel.app/api/v1`

Deploy the backend first, then set the frontend env var, then update the backend CORS origin with the final frontend URL and redeploy.

Serverless limits: request bodies are capped at about 4.5 MB, and bulk-conversion jobs run in-process, so large uploads and long bulk jobs are not reliable on Vercel.

## Development Workflow

```powershell
git checkout -b feature/<short-description>
```

- Backend tests: `cd backend; .venv\Scripts\python.exe -m pytest`
- Backend lint: `cd backend; .venv\Scripts\python.exe -m ruff check .`
- Backend contract check: `cd backend; .venv\Scripts\python.exe -m scripts.export_openapi --check`
- Frontend tests: `cd frontend; npm test`
- Frontend type check: `cd frontend; npm run typecheck`
- Frontend lint: `cd frontend; npm run lint`
- Frontend contract check: `cd frontend; npm run check:api-types`
- Production build: `cd frontend; npm run build`
- Regenerate API types after backend changes:
  ```powershell
  cd backend; .venv\Scripts\python.exe -m scripts.export_openapi
  cd ../frontend; npm run generate:api-types
  ```
- Add new tools by adding a module exposing a `TOOL` constant under `backend/app/registry/definitions/` — no other files need editing.

The two contract checks are read-only: the backend compares its live OpenAPI
schema with the checked-in snapshot, and the frontend verifies generated types
against that snapshot. Both exit unsuccessfully on drift rather than silently
rewriting generated files. Run tests, lint, type checks, both contract checks,
and a production build before merging changes.

See [ENGINEERING_REVIEW.md](ENGINEERING_REVIEW.md) for the engineering-pass scope,
measured results, changed-file inventory, and deferred deployment concerns.
