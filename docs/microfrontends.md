# Micro-frontends

The CRM is the **shell**. Other apps (today: Task Management) are **remote apps**: each is its own
repository and its own React app, with its own layout, served under a path on the CRM's origin.
They share one sign-in, the CRM's.

All of it is described in [`microfrontends.json`](../microfrontends.json), the single source for:

| Used by | Reads |
|---|---|
| `vite.config.ts` | dev proxy (`basePath` → `localhost:devPort`) and the preview fallback for each remote |
| `scripts/dev-all.mjs` | which remotes to start, from where (`dirEnv` / `fallbackDirs`), with which base and port |
| `scripts/build-remotes.mjs` | which remotes to build into `dist/<basePath>` |
| `src/app/microfrontends.ts` | session cookie and channel names; the URL each remote opens at |

## Running

```bash
npm run dev            # CRM on :5173 + every remote, each proxied under its basePath
npm run dev:crm        # CRM alone (a remote's path then shows "not running")
npm run dev:remotes    # remotes alone
npm run build:all      # CRM build, then every remote into dist/<basePath>
```

Open remotes **through the CRM** (`http://localhost:5173/task/`). Do not run a remote's own
`npm run dev` on its own: it would serve base `/`, which the CRM proxy cannot use, and it would not
share the sign-in.

Each remote's checkout is found through its `dirEnv` in the CRM `.env` (absolute, or relative to the
CRM folder), e.g.

```
TASK_APP_DIR=../Task-Management-User-Interface
```

Without it, the first of its `fallbackDirs` that has a `package.json` is used.

## Contract a remote app must keep

1. **Base path.** Build and serve with `--base <basePath>`; route under that base.
2. **Shared sign-in.** Read the CRM's `session.authCookie` (`fi-crm-auth`): chunked cookie, AES-GCM
   encrypted with a key derived from the CRM's `VITE_COOKIE_SECRET` (passed to the remote as
   `VITE_CRM_COOKIE_SECRET`), or `p.` + base64url JSON on plain-HTTP hosts. Its value is
   `{ token, expiresAt, companies, user }`. Keep the reader in step with the CRM's
   `src/api/cookieVault.ts`. (Task Management: `src/lib/crmSso.ts`.)
3. **No login of its own.** When the cookie is missing or expired, send the user to the CRM login with
   `?next=<remote URL>`; the CRM sends them back after signing in.
4. **One session.** On sign-out, clear the CRM cookies and post `{ type: 'logout' }` on the
   `session.channel` BroadcastChannel (`fi-crm-session`); on `logout` or `expired` from it, sign out.
5. **Look.** Remotes keep their own layout but follow the CRM theme (blue `#1E56A0` chrome, red
   `#C4161C` active marker, the CRM loader and tooltip).

## Adding a remote

1. Add an entry to `remotes` in `microfrontends.json` (`name`, `title`, `basePath`, a free `devPort`,
   `dirEnv`, `fallbackDirs`, `urlEnv`).
2. Point its `dirEnv` at the checkout in `.env`.
3. In the remote, implement the contract above.
4. Link to it from the CRM with `remoteAppUrl('<name>')` (full page load — it is a separate app).
