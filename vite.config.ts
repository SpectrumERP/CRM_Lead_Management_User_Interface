import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

/**
 * Task Management lives in ./task-management as its own app (own React / Tailwind 3 / router) and is
 * served under /task: in development this server forwards /task to its dev server (`npm run dev:task`,
 * port 5174, base /task/); a build puts it in dist/task (`npm run build:task`).
 */
const TASK_BASE = '/task/'
const TASK_DEV_PORT = 5174
/** /task, /task/, /task/<route> — not /tasks or other CRM paths. */
const TASK_PATH = '^/task(?:/|$)'

/** Preview of the built app: /task/<route> (not a file) → dist/task/index.html, the task app's own SPA. */
function taskAppPreviewFallback(): Plugin {
  return {
    name: 'task-app-preview-fallback',
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const pathname = (req.url ?? '').split('?')[0] ?? ''
        if (new RegExp(TASK_PATH).test(pathname) && !/\.[a-z0-9]+$/i.test(pathname)) req.url = `${TASK_BASE}index.html`
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), taskAppPreviewFallback()],
    resolve: {
      alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
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
    proxy: {
      // Task Management dev server (pages, assets and HMR websocket).
      [TASK_PATH]: {
        target: `http://localhost:${TASK_DEV_PORT}`,
        ws: true,
        // Task dev server not running (e.g. `npm run dev:crm`): explain instead of a bare 502.
        configure(proxy) {
          proxy.on('error', (_error, _req, res) => {
            if (!('writeHead' in res) || res.headersSent) return
            res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(
              '<h2 style="font-family:system-ui">Task Management is not running</h2>' +
                '<p style="font-family:system-ui">Start both apps with <code>npm run dev</code> ' +
                '(or the task app alone with <code>npm run dev:task</code>), then reload.</p>',
            )
          })
        },
      },
    },
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
    // Serve the built dist/task (not the dev proxy, which preview would otherwise inherit).
    proxy: {},
  },
})
