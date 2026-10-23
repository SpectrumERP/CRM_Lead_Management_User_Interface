import { defineConfig, loadEnv, type Plugin, type UserConfig } from 'vite'
import { federation } from '@module-federation/vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

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

function spectrumRemote(port: number, host: string | boolean, env: Record<string, string>, command: 'serve' | 'build'): UserConfig {
  // Routes live under the shell's /crm (src/app/paths.ts reads this).
  const routeBase = env.VITE_CRM_ROUTE_BASE || '/crm'
  process.env.VITE_CRM_ROUTE_BASE = routeBase
  // A build serves every environment: the API must be a path on the page's host (nginx picks the backend).
  // Unset, the CRM would call /api (SpectrumERP-API); a full URL would tie the build to one environment.
  const apiPath = (env.VITE_SPECTRUM_API_URL ?? '').trim()
  if (command === 'build' && apiPath !== 'off' && !apiPath.startsWith('/')) {
    throw new Error(`Set VITE_SPECTRUM_API_URL to a path such as /crm-api (now "${apiPath}"). See SpectrumERP-Web/docs/deployment/DEPLOYMENT-GUIDE.md.`)
  }
  const shellUrl = (env.SPECTRUM_SHELL_URL || `http://${env.REMOTE_DEV_HOST || 'localhost'}:${env.ERP_PORT || 5173}`).replace(/\/+$/, '')
  // Assets must load from this server when the shell, on another origin, imports the remote.
  const publicUrl = env.CRM_PUBLIC_URL || (command === 'serve'
    ? `http://${env.REMOTE_DEV_HOST || 'localhost'}:${port}/`
    : `${routeBase.replace(/\/+$/, '')}/`)
  const publicBase = publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`
  return {
    base: publicBase,
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
          'react/jsx-runtime': { singleton: true },
          'react/jsx-dev-runtime': { singleton: true },
          'react-router-dom': { singleton: true },
        },
        dts: false,
      }),
    ],
    resolve: { alias },
    build: { target: 'esnext', chunkSizeWarningLimit: 11000 },
    server: {
      host,
      port,
      strictPort: true,
      ...(command === 'serve' ? { origin: new URL(publicBase, shellUrl).origin } : {}),
    },
    preview: { host, port, strictPort: true },
  }
}

const standalone: UserConfig = {
  plugins: [react(), tailwindcss()],
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
  },
  preview: {
    host: true,
    strictPort: true,
  },
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.CRM_PORT || 5174)
  const host = env.DEV_SERVER_HOST || true
  if (mode === SPECTRUM_MODE) return spectrumRemote(port, host, env, command)
  const shellUrl = (env.SPECTRUM_SHELL_URL || `http://${env.REMOTE_DEV_HOST || 'localhost'}:${env.ERP_PORT || 5173}`).replace(/\/+$/, '')
  process.env.VITE_SPECTRUM_URL ??= env.VITE_SPECTRUM_URL || (command === 'serve' ? shellUrl : '')
  return {
    ...standalone,
    server: { ...standalone.server, host, port },
    preview: { ...standalone.preview, host, port },
  }
})
