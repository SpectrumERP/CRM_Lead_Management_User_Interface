#!/usr/bin/env node
/**
 * `npm run dev`: runs the CRM (http://localhost:5173) and Task Management (served under
 * http://localhost:5173/task, its own dev server on 5174) together. Ctrl+C stops both.
 * `npm run dev:crm` runs the CRM alone (then /task shows a "not running" notice).
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnv } from 'vite'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const root = resolve(import.meta.dirname, '..')

// First run: install the task app's own dependencies.
if (!existsSync(resolve(root, 'task-management/node_modules'))) {
  console.log('Installing Task Management dependencies…')
  const install = spawnSync(npm, ['--prefix', 'task-management', 'install'], { cwd: root, stdio: 'inherit' })
  if (install.status !== 0) process.exit(install.status ?? 1)
}

// The task app reads the CRM's encrypted sign-in cookie (shared login), so it needs the same secret.
const secret = loadEnv('development', root, 'VITE_').VITE_COOKIE_SECRET
const taskEnv = secret ? { ...process.env, VITE_CRM_COOKIE_SECRET: secret } : process.env

const children = [
  spawn(npm, ['run', 'dev:task'], { cwd: root, stdio: 'inherit', env: taskEnv }),
  spawn(npm, ['run', 'dev:crm'], { cwd: root, stdio: 'inherit' }),
]

function stop(code = 0) {
  for (const child of children) if (!child.killed) child.kill('SIGTERM')
  process.exit(code)
}

for (const child of children) child.on('exit', (code) => stop(code ?? 0))
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
