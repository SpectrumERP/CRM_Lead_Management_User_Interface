#!/usr/bin/env node
/**
 * Builds Task Management into dist/task with base /task/ (run after the CRM build, which empties dist).
 * Its IIS web.config rewrites unknown paths to /index.html — inside the CRM that must be
 * /task/index.html, so the copied file is adjusted.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnv } from 'vite'

const BASE = '/task/'
const root = resolve(import.meta.dirname, '..')
const outDir = resolve(root, 'dist/task')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

// The task app reads the CRM's encrypted sign-in cookie (shared login), so it needs the same secret.
const secret = loadEnv('production', root, 'VITE_').VITE_COOKIE_SECRET
const env = secret ? { ...process.env, VITE_CRM_COOKIE_SECRET: secret } : process.env

const result = spawnSync(
  npm,
  ['--prefix', 'task-management', 'run', 'build', '--', '--base', BASE, '--outDir', outDir, '--emptyOutDir'],
  { cwd: root, stdio: 'inherit', env },
)
if (result.status !== 0) process.exit(result.status ?? 1)

const webConfig = resolve(outDir, 'web.config')
if (existsSync(webConfig)) {
  const text = readFileSync(webConfig, 'utf8').replace('url="/index.html"', `url="${BASE}index.html"`)
  writeFileSync(webConfig, text)
}
console.log(`Task Management built → dist/task (served at ${BASE})`)
