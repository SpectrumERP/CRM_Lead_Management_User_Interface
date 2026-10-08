#!/usr/bin/env node
/**
 * `npm run dev`: the CRM shell (http://localhost:5173) plus every remote app in microfrontends.json,
 * each on its own dev server (devPort, base = basePath) that the CRM dev server proxies under basePath —
 * same origin, so the remotes share the CRM sign-in cookie. Ctrl+C stops them all.
 * `npm run dev:crm` runs the CRM alone (a remote's path then shows a "not running" notice);
 * `npm run dev:remotes` (this script with --remotes-only) runs the remotes alone.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { remoteApps, remoteEnv } from './microfrontends.mjs'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const root = resolve(import.meta.dirname, '..')
const remotesOnly = process.argv.includes('--remotes-only') || process.argv.includes('--task-only')

const remotes = remoteApps(root, 'development').filter((remote) => {
  if (remote.dir) {
    console.log(`${remote.title}: ${remote.dir} → http://localhost:5173${remote.basePath}`)
    return true
  }
  console.log(`${remote.title} not found (set ${remote.dirEnv} in .env to its checkout) — skipped.`)
  return false
})
if (remotesOnly && remotes.length === 0) process.exit(1)

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
