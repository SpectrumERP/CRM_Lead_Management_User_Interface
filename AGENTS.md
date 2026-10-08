# force-intellect-crm

React + Vite + Tailwind CSS CRM for Force Intellect lead management.

## Scripts

- `npm run dev` — CRM on port 5173 plus every remote app (micro-frontends) under its path, e.g. `/task/`
- `npm run dev:crm` — CRM alone
- `npm run dev:remotes` — remote apps alone
- `npm run build` — production build
- `npm run build:all` — CRM build, then every remote app into `dist/<basePath>`
- `npm run preview` — serve `dist/` on port 5173
- `npm run test` — vitest

## Project Structure

- `src/main.tsx` — React entry; imports `src/index.css` and mounts `src/App.tsx`
- `src/App.tsx` — App shell, router, providers
- `src/index.css` — Tailwind v4 `@theme` tokens and global styles
- `index.html` — Vite HTML shell (`#root`)
- `package.json` — npm scripts and dependencies
- `vite.config.ts` — Vite, React, Tailwind v4, `@` → `src`
- `microfrontends.json` — remote apps (separate repos, e.g. Task Management) and the shared-session contract; see `docs/microfrontends.md`

## Styling

Tailwind CSS v4 via `@tailwindcss/vite`. Put tokens in `src/index.css` `@theme`. UI primitives live in `src/ui`; screens in `src/pages`.
