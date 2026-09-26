# force-intellect-crm

React + Vite + Tailwind CSS CRM for Force Intellect lead management.

## Scripts

- `npm run dev` — Vite on port 5173
- `npm run build` — production build
- `npm run preview` — serve `dist/` on port 5173
- `npm run test` — vitest

## Project Structure

- `src/main.tsx` — React entry; imports `src/index.css` and mounts `src/App.tsx`
- `src/App.tsx` — App shell, router, providers
- `src/index.css` — Tailwind v4 `@theme` tokens and global styles
- `index.html` — Vite HTML shell (`#root`)
- `package.json` — npm scripts and dependencies
- `vite.config.ts` — Vite, React, Tailwind v4, `@` → `src`

## Styling

Tailwind CSS v4 via `@tailwindcss/vite`. Put tokens in `src/index.css` `@theme`. UI primitives live in `src/ui`; screens in `src/pages`.
