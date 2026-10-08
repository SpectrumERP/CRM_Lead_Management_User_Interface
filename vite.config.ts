import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
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
    /** /task, /task/, /task/<route> — not /tasks or other CRM paths. */
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

export default defineConfig({
  plugins: [react(), tailwindcss(), remoteAppsPreviewFallback()],
    resolve: {
      alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
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
    port: 5173,
    strictPort: true,
    proxy: Object.fromEntries(
      remotes.flatMap((remote) => [
        [remote.pathPattern, remoteProxy(remote)],
        // A remote's root-relative API calls (e.g. /api/...) land on this origin in dev; send them to its
        // dev server, whose own proxy forwards them to the backend in its .env.
        ...(remote.devApiPaths ?? []).map((apiPath) => [
          `^${apiPath.replace(/\/+$/, '')}(?:/|$)`,
          remoteProxy(remote),
        ]),
      ]),
    ),
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
    // Serve the built dist/<basePath> remotes (not the dev proxy, which preview would otherwise inherit).
    proxy: {},
  },
})
