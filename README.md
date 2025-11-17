# Checklister Workspace

This repository is now organized as a two-part workspace so the web app and any future server runtime stay isolated and easier to reason about.

## Structure

- `frontend/` – React + Vite client (moved from the repo root). All UI, assets, configs, and build artifacts now live here.
- `backend/` – Express + TypeScript API starter ready for deployment to Render (or any Node host).
- `.github/` – Issue templates and workflows shared by the whole workspace.

## Frontend quick start

```bash
cd frontend
npm install
npm run dev
```

Use `npm run build` inside `frontend/` for production bundles. The generated files land in `frontend/dist`.

## Backend quick start

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

The starter API serves health checks plus auth/checklist endpoints backed by in-memory data so you can validate the contract fast. Wire it up to Postgres (Render has a managed option) before shipping to production.

## Notes

- Root-level Node dependencies and configs were moved into `frontend/` so editors and tooling can scope paths correctly.
- Update any deployment scripts to point at `frontend/` for client builds (e.g., `npm --prefix frontend run build`).
- When you introduce backend code, keep shared types or utilities in their own package/folder for clarity.
