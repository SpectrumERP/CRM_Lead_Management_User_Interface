#!/usr/bin/env node
/**
 * `npm run dev`: the CRM shell (CRM_PORT, default 5174) plus every remote app in microfrontends.json,
 * each on its own dev server (devPort, base = basePath) that the CRM dev server proxies under basePath —
 * same origin, so the remotes share the CRM sign-in cookie. Ctrl+C stops them all.
 * `npm run dev:crm` runs the CRM alone (a remote's path then shows a "not running" notice);
 * `npm run dev:remotes` (this script with --remotes-only) runs the remotes alone.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnv } from 'vite'
import { remoteApps, remoteEnv } from './microfrontends.mjs'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const root = resolve(import.meta.dirname, '..')
const crmEnv = loadEnv('development', root, '')
const crmPort = Number(crmEnv.CRM_PORT || 5174)
const displayHost = crmEnv.REMOTE_DEV_HOST || 'localhost'
const remotesOnly = process.argv.includes('--remotes-only') || process.argv.includes('--task-only')

const remotes = remoteApps(root, 'development').filter((remote) => {
  if (remote.dir) {
    console.log(`${remote.title}: ${remote.dir} → http://${displayHost}:${crmPort}${remote.basePath}`)
    return true
  }
  console.log(`${remote.title} not found (set ${remote.dirEnv} in .env to its checkout) — skipped.`)
  return false
})
if (remotesOnly && remotes.length === 0) process.exit(1)

// Already running (e.g. in another terminal tab)? Say so plainly instead of Vite's "Port … is already in use".
function portTaken(port, host) {
  return new Promise((done) => {
    const probe = createServer()
    probe.once('error', () => done(true))
    probe.once('listening', () => probe.close(() => done(false)))
    probe.listen(port, host)
  })
}
// Vite binds `localhost` (often ::1) or all interfaces — check both.
async function portBusy(port) {
  return (await portTaken(port)) || (await portTaken(port, 'localhost'))
}
const ports = [...(remotesOnly ? [] : [crmPort]), ...remotes.map((remote) => remote.devPort)]
const busy = []
for (const port of ports) if (await portBusy(port)) busy.push(port)
if (busy.length) {
  console.log(`
The dev servers are already running (port ${busy.join(', ')} in use) — probably \`npm run dev\` in another terminal.
  Open:  http://${displayHost}:${crmPort}  ·  ${remotes.map((remote) => `http://${displayHost}:${crmPort}${remote.basePath}`).join('  ·  ')}
  Restart: press Ctrl+C in that terminal, or run
           lsof -tiTCP:${ports.join(',')} -sTCP:LISTEN | xargs kill
           then \`npm run dev\` again.
`)
  process.exit(1)
}

// First run: install each remote's own dependencies.
for (const remote of remotes) {
  if (existsSync(resolve(remote.dir, 'node_modules'))) continue
  console.log(`Installing ${remote.title} dependencies…`)
  const install = spawnSync(npm, ['--prefix', remote.dir, 'install'], { cwd: root, stdio: 'inherit' })
  if (install.status !== 0) process.exit(install.status ?? 1)
}

const env = remoteEnv(root, 'development')
const children = [
  ...remotes.map((remote) =>
    spawn(
      npm,
      ['--prefix', remote.dir, 'run', 'dev', '--', '--base', remote.basePath, '--port', String(remote.devPort), '--strictPort'],
      { cwd: root, stdio: 'inherit', env },
    ),
  ),
  ...(remotesOnly ? [] : [spawn(npm, ['run', 'dev:crm'], { cwd: root, stdio: 'inherit' })]),
]

function stop(code = 0) {
  for (const child of children) if (!child.killed) child.kill('SIGTERM')
  process.exit(code)
}

for (const child of children) child.on('exit', (code) => stop(code ?? 0))
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
