# Micro-frontends

The CRM is the **shell**. Other apps (today: Task Management and Documents Management) are **remote apps**: each is its own
repository and its own React app, with its own layout. They can be built under a path on the CRM's origin
or hosted separately. The shared-cookie sign-in
contract works when the browser can read the CRM cookie from the remote (same origin, or a deliberately
configured shared parent-domain cookie). Different registrable domains need a server/token or explicit
shell messaging integration; browser cookies and `BroadcastChannel` do not cross origins by themselves.

All of it is described in [`microfrontends.json`](../microfrontends.json), the single source for:

| Used by | Reads |
|---|---|
| `vite.config.ts` | dev proxy (`basePath` → `localhost:devPort`; `devApiPaths` → the dev server of the remote whose page made the call, by its Referer) and the preview fallback for each remote |
| `scripts/dev-all.mjs` | which remotes to start, from where (`dirEnv` / `fallbackDirs`), with which base and port |
| `scripts/build-remotes.mjs` | which remotes to build into `dist/<basePath>` |
| `src/app/microfrontends.ts` | session cookie and channel names; the URL each remote opens at |

## Running

```bash
npm run dev            # CRM on :5173 + every remote, each proxied under its basePath
npm run dev:crm        # CRM alone (a remote's path then shows "not running")
npm run dev:remotes    # remotes alone
npm run build:all                         # production mode (default)
npm run build:all -- --mode development  # local development config
npm run build:all -- --mode staging      # staging config
npm run build:all -- --mode uat           # UAT config
npm run build:all -- --mode production   # production config
```

For the standard same-origin setup, open remotes **through the CRM** (`http://localhost:5173/task/`).
For a separately hosted remote, configure the URLs below and open its configured address.

Each remote's checkout is found through its `dirEnv` in the CRM `.env` (absolute, or relative to the
CRM folder), e.g.

```
TASK_APP_DIR=../Task-Management-User-Interface
DOCUMENTS_APP_DIR=../DocumentManagement-Web
```

Every remote is started and built with `VITE_CRM_SSO=true` (and the CRM cookie secret as
`VITE_CRM_COOKIE_SECRET`). Task Management always signs in through the CRM; Documents Management can
also run on its own or in the Spectrum ERP shell, and switches to the CRM sign-in only with this flag
(its `src/api/crmSso.ts`).

Without it, the first of its `fallbackDirs` that has a `package.json` is used.

Vite loads `.env` plus `.env.<mode>` from the CRM checkout. The selected mode is also passed to every
remote build. For same-origin hosting, no login URL override is needed: Task returns to `/login` on its
current host. For a remote on another host, define matching public URLs in the mode-specific CRM env:

```dotenv
# CRM .env.uat
VITE_CRM_LOGIN_URL=https://crm-uat.example.com/login
VITE_TASK_APP_URL=https://tasks-uat.example.com/
VITE_TASK_PUBLIC_URL=https://tasks-uat.example.com/
VITE_COOKIE_DOMAIN=.example.com
```

`VITE_CRM_LOGIN_URL`, `VITE_TASK_PUBLIC_URL` and `VITE_DOCUMENTS_PUBLIC_URL` are copied into the remote
builds (Documents Management reads `VITE_DOCUMENTS_PUBLIC_URL` as Task reads `VITE_TASK_PUBLIC_URL`). The CRM's
`VITE_TASK_APP_URL` must point at that same Task deployment so the CRM can validate the `next` return
URL. Add equivalent values to `.env.development`, `.env.staging`, or `.env.production` as needed. These
URLs are public configuration, not secrets. Set `VITE_COOKIE_DOMAIN` only when CRM and Task are
subdomains of the same site; it deliberately makes the session cookie available to sibling subdomains.
The remote receives it as `VITE_CRM_COOKIE_DOMAIN` so logout removes the same shared cookie. Local
separate-origin development can use
`http://localhost:5173/login` and `http://localhost:5174/` respectively.

## Contract a remote app must keep

1. **Base path.** Build and serve with `--base <basePath>`; route under that base.
2. **Shared sign-in.** Read the CRM's `session.authCookie` (`fi-crm-auth`): chunked cookie, AES-GCM
   encrypted with a key derived from the CRM's `VITE_COOKIE_SECRET` (passed to the remote as
   `VITE_CRM_COOKIE_SECRET`), or `p.` + base64url JSON on plain-HTTP hosts. Its value is
   `{ token, expiresAt, companies, user }`. Keep the reader in step with the CRM's
   `src/api/cookieVault.ts`. (Task Management: `src/lib/crmSso.ts`; Documents Management:
   `src/api/crmSso.ts` with its `cookieVault.ts` / `authStore.ts`.)
3. **No login of its own.** When the cookie is missing or expired, send the user to the CRM login with
   `?next=<remote URL>`; the CRM sends them back after signing in.
4. **One session.** On sign-out, clear the CRM cookies and post `{ type: 'logout' }` on the
   `session.channel` BroadcastChannel (`fi-crm-session`); on `logout` or `expired` from it, sign out.
5. **Look.** Remotes keep their own layout but follow the CRM theme (blue `#1E56A0` chrome, red
   `#C4161C` active marker, the CRM loader and tooltip).

## Adding a remote

1. Add an entry to `remotes` in `microfrontends.json` (`name`, `title`, `basePath`, a free `devPort`,
   `dirEnv`, `fallbackDirs`, `urlEnv`). If the remote calls its API with root-relative paths in dev
   (Task Management: `/api/...`), list them in `devApiPaths` so the CRM dev server forwards them to
   the remote's dev server instead of answering with its own `index.html`. Several remotes may list
   the same path: each call goes to the remote whose page made it.
2. Point its `dirEnv` at the checkout in `.env`.
3. In the remote, implement the contract above.
4. Link to it from the CRM with `remoteAppUrl('<name>')` (full page load — it is a separate app): add it
   to the module launcher (`src/components/ModuleLauncher.tsx`, and Task Management's copy), and to
   `remoteAppReturnPath` in `src/app/paths.ts` so the CRM login can send users back to it.
