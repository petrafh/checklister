# Checklister

Glassmorphism checklist app built with React, TypeScript, Vite, and Tailwind CSS. Create multiple lists, add items, and check them off in a calm minimal workspace. Every change stays in this browser via `localStorage`.

## Features

- Create unlimited checklists with optional prefilled tasks.
- Check off, clear, or delete individual items with instant progress bars.
- Minimal glass UI powered by Tailwind utilities and custom gradients.
- Responsive layout that keeps the experience centered on any screen size.
- Manual light/dark toggle with distinct glass backgrounds for each mode.
- Automatic persistence to `localStorage` so your rituals and routines stay private.

## Getting Started

```bash
npm install
npm run dev
```

Open the printed URL (defaults to [http://localhost:5173](http://localhost:5173)) to use the app. Use `npm run build` to generate a production bundle.

## Stack

- [Vite](https://vite.dev/) + React + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) for utility-first styling and glassmorphism accents
- Local state/`localStorage` for persistence
