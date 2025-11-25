# Checklister Workspace

This repository now only hosts the web client for Checklister. Point it at whatever API you deploy by setting `VITE_API_URL`.

## Structure

- `frontend/` – React + Vite client (moved from the repo root). All UI, assets, configs, and build artifacts now live here.
- `.github/` – Issue templates and workflows shared by the workspace.

## Frontend quick start

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Set `VITE_API_URL` in `.env` to point at your Render backend (or `http://localhost:4000` when running the API locally). Use `npm run build` inside `frontend/` for production bundles. The generated files land in `frontend/dist`.
If you plan to run the old Express starter locally, clone it separately or point to an existing deployment.
