# Checklister

Glassmorphism checklist app built with React, TypeScript, Vite, and Tailwind CSS. Create multiple lists, add items, and check them off in a calm minimal workspace. Point the client at your own API with `VITE_API_URL` if you want sync across devices.

## Features

- Create unlimited checklists with optional prefilled tasks.
- Check off, clear, or delete individual items with instant progress bars.
- Minimal glass UI powered by Tailwind utilities and custom gradients.
- Responsive layout that keeps the experience centered on any screen size.
- Manual light/dark toggle with distinct glass backgrounds for each mode.
- Optional cloud-ready persistence through an API of your choice (plus manual JSON export/import).

## Getting Started

```bash
npm install
cp .env.example .env
# set VITE_API_URL in .env if using a remote API (defaults to http://localhost:4000)
npm run dev
```

Open the printed URL (defaults to [http://localhost:5173](http://localhost:5173)). If you rely on a backend, ensure it is running on the URL defined in `VITE_API_URL`. Use `npm run build` to generate a production bundle.

## Stack

- [Vite](https://vite.dev/) + React + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) for utility-first styling and glassmorphism accents
- Local state/`localStorage` for persistence
