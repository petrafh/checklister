# Checklister API

This folder contains a lightweight Express + TypeScript service that you can deploy to Render (or any Node host) to power real cross-device accounts. It currently keeps data in-memory so you can validate the contract quickly; swap the storage implementation for Postgres/Supabase/etc. before going to production.

## Local development

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

The API listens on `http://localhost:4000` by default.

### Scripts

- `npm run dev` – start the server with hot-reload via `tsx`.
- `npm run build` – compile TypeScript to `dist/`.
- `npm run start` – run the compiled server (used by Render production deploys).

## Environment variables

| Name | Description |
| --- | --- |
| `PORT` | Port for the HTTP server (`4000` default). |
| `JWT_SECRET` | Secret key for signing auth tokens (use a long random string in production). |
| `CORS_ORIGIN` | Comma-separated list of allowed origins (e.g., `https://your-frontend.onrender.com`). |

## API surface (preview)

- `POST /auth/signup` – create a user, returns JWT + starter checklists.
- `POST /auth/login` – authenticate existing user.
- `GET /me` – return profile + checklists for the bearer token.
- `GET /checklists` – list all checklists for the authed user.
- `POST /checklists` – create a new checklist.
- `PUT /checklists/:id` – update title/items.
- `DELETE /checklists/:id` – remove a checklist.

All protected endpoints expect `Authorization: Bearer <token>` headers. Replace the in-memory store with your database of choice and update the controller logic as needed.
