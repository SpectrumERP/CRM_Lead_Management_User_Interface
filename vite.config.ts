import { defineConfig, loadEnv, type Plugin, type UserConfig } from 'vite'
import { federation } from '@module-federation/vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import http from 'node:http'
import path from 'node:path'

import microfrontends from './microfrontends.json'

/**
 * Route-based micro-frontends (microfrontends.json): each remote app is its own repository, served under
 * its basePath on this origin so it shares the CRM sign-in. In development this server forwards the
 * basePath to the remote's dev server (devPort, started by `npm run dev`); a build puts the remote in
 * dist/<basePath> (`npm run build:remotes`).
 */
const remotes = microfrontends.remotes.map((remote) => {
  const segment = remote.basePath.replace(/^\/+|\/+$/g, '')
  return {
    ...remote,
    /** /documentsmanagement and its nested routes, not similarly prefixed CRM paths. */
    pathPattern: `^/${segment}(?:/|$)`,
  }
})

/** Preview of the built app: <basePath><route> (not a file) → dist/<basePath>index.html, the remote's own SPA. */
function remoteAppsPreviewFallback(): Plugin {
  return {
    name: 'remote-apps-preview-fallback',
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const pathname = (req.url ?? '').split('?')[0] ?? ''
        const remote = remotes.find((r) => new RegExp(r.pathPattern).test(pathname))
        if (remote && !/\.[a-z0-9]+$/i.test(pathname)) req.url = `${remote.basePath}index.html`
        next()
      })
    },
  }
}

/** Dev proxy for one remote (pages, assets and HMR websocket); explains when its dev server is down. */
function remoteProxy(remote: (typeof remotes)[number]) {
  return {
    target: `http://localhost:${remote.devPort}`,
    ws: true,
    configure(proxy: { on: (event: 'error', handler: (error: Error, req: unknown, res: unknown) => void) => void }) {
      proxy.on('error', (_error, _req, res) => {
        const out = res as { headersSent?: boolean; writeHead?: (code: number, headers: Record<string, string>) => void; end: (body: string) => void }
        if (!out.writeHead || out.headersSent) return
        out.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' })
        out.end(
          `<h2 style="font-family:system-ui">${remote.title} is not running</h2>` +
            '<p style="font-family:system-ui">Start everything with <code>npm run dev</code> ' +
            '(or the remote apps alone with <code>npm run dev:remotes</code>), then reload.</p>',
        )
      })
    },
  }
}

/**
 * Dev: a remote's root-relative API calls (`devApiPaths`, e.g. /api/...) land on this origin, and
 * several remotes can use the same path. Each call goes to the dev server of the remote whose page
 * made it (its Referer, e.g. /documentsmanagement/...), whose own proxy forwards it to the backend in its .env.
 * A call without such a page goes to the first remote that lists the path.
 */
function remoteApiRouter(): Plugin {
  const routes = remotes.flatMap((remote) =>
    (remote.devApiPaths ?? []).map((apiPath) => ({ remote, pattern: new RegExp(`^${apiPath.replace(/\/+$/, '')}(?:/|$)`) })),
  )
  return {
    name: 'remote-api-router',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0] ?? ''
        const claims = routes.filter((route) => route.pattern.test(pathname))
        if (claims.length === 0) return next()
        let page = ''
        try {
          page = new URL(req.headers.referer ?? '').pathname
        } catch {
          // No (valid) Referer: the first claim below.
        }
        const { remote } = claims.find((route) => new RegExp(route.remote.pathPattern).test(page)) ?? claims[0]
        const upstream = http.request(
          { host: 'localhost', port: remote.devPort, method: req.method, path: req.url, headers: req.headers },
          (answer) => {
            res.writeHead(answer.statusCode ?? 502, answer.headers)
            answer.pipe(res)
          },
        )
        upstream.on('error', () => {
          if (res.headersSent) return res.end()
          res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end(`${remote.title} is not running (localhost:${remote.devPort}). Start it with npm run dev, then retry.`)
        })
        req.pipe(upstream)
      })
    },
  }
}

const alias = { '@': path.resolve(import.meta.dirname, './src') }

/**
 * `vite --mode spectrum` (npm run dev:spectrum / build:spectrum): the CRM as a Module Federation remote of
 * the Spectrum ERP shell (SpectrumERP-Web), mounted at /crm. The shell signs the user in and writes the
 * shared auth cookie; this build exposes ./App without its own router and uses the shell's React and
 * React Router.
 */
const SPECTRUM_MODE = 'spectrum'

/**
 * As a remote this server only feeds the shell. A page opened on it directly goes to the same page in the
 * shell, which has the one Spectrum ERP login. Module requests (Accept without text/html) pass through.
 */
function redirectPagesToShell(routeBase: string, shellUrl: string): Plugin {
  return {
    name: 'redirect-pages-to-spectrum-shell',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' || !req.headers.accept?.includes('text/html')) return next()
        res.writeHead(302, { Location: `${shellUrl}${routeBase}${req.url === '/' ? '/' : req.url}` })
        res.end()
      })
    },
  }
}

function spectrumRemote(port: number, host: string | boolean, env: Record<string, string>): UserConfig {
  // Routes live under the shell's /crm (src/app/paths.ts reads this).
  const routeBase = env.VITE_CRM_ROUTE_BASE || '/crm'
  process.env.VITE_CRM_ROUTE_BASE = routeBase
  const shellUrl = (env.SPECTRUM_SHELL_URL || `http://${env.REMOTE_DEV_HOST || 'localhost'}:${env.ERP_PORT || 5173}`).replace(/\/+$/, '')
  // Assets must load from this server when the shell, on another origin, imports the remote.
  const publicUrl = env.CRM_PUBLIC_URL || `http://${env.REMOTE_DEV_HOST || 'localhost'}:${port}/`
  const publicOrigin = new URL(publicUrl).origin
  return {
    base: publicUrl,
    plugins: [
      redirectPagesToShell(routeBase, shellUrl),
      react(),
      tailwindcss(),
      federation({
        name: 'crm',
        filename: 'remoteEntry.js',
        exposes: { './App': './src/SpectrumApp.tsx' },
        // Same instances as the shell: one React, and one router so shell and CRM links share history.
        shared: {
          react: { singleton: true },
          'react-dom': { singleton: true },
          'react-router-dom': { singleton: true },
        },
        dts: false,
      }),
    ],
    resolve: { alias },
    build: { target: 'esnext', chunkSizeWarningLimit: 11000 },
    server: { host, port, strictPort: true, origin: publicOrigin },
    preview: { host, port, strictPort: true },
  }
}

const standalone: UserConfig = {
  plugins: [react(), tailwindcss(), remoteAppsPreviewFallback(), remoteApiRouter()],
  resolve: { alias },
  build: {
    // OpenCV alone is ~10 MB; it loads only when the business card scanner opens.
    chunkSizeWarningLimit: 11000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@techstark/opencv-js')) return 'opencv'
          if (id.includes('node_modules/tesseract.js')) return 'tesseract'
          if (id.includes('node_modules/react-router')) return 'router'
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react'
        },
      },
    },
  },
  server: {
    host: true,
    strictPort: true,
    // Each remote's pages, assets and HMR. Its API calls (devApiPaths) go through remoteApiRouter.
    proxy: Object.fromEntries(remotes.map((remote) => [remote.pathPattern, remoteProxy(remote)])),
  },
  preview: {
    host: true,
    strictPort: true,
    // Serve the built dist/<basePath> remotes (not the dev proxy, which preview would otherwise inherit).
    proxy: {},
  },
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.CRM_PORT || 5174)
  const host = env.DEV_SERVER_HOST || true
  if (mode === SPECTRUM_MODE) return spectrumRemote(port, host, env)
  return {
    ...standalone,
    server: { ...standalone.server, host, port },
    preview: { ...standalone.preview, host, port },
  }
})
