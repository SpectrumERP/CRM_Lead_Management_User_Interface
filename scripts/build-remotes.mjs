#!/usr/bin/env node
/**
 * Builds every remote app in microfrontends.json into dist/<basePath> with that base (run after the CRM
 * build, which empties dist). A remote's IIS web.config rewrites unknown paths to /index.html — inside
 * the CRM that must be <basePath>index.html, so the copied file is adjusted.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { remoteApps, remoteEnv } from './microfrontends.mjs'

const root = resolve(import.meta.dirname, '..')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const env = remoteEnv(root, 'production')

let failed = false
for (const remote of remoteApps(root, 'production')) {
  if (!remote.dir) {
    console.error(`${remote.title} not found (set ${remote.dirEnv} in .env to its checkout) — not built.`)
    failed = true
    continue
  }
  const outDir = resolve(root, 'dist', remote.basePath.replace(/^\/+|\/+$/g, ''))
  const result = spawnSync(
    npm,
    ['--prefix', remote.dir, 'run', 'build', '--', '--base', remote.basePath, '--outDir', outDir, '--emptyOutDir'],
    { cwd: root, stdio: 'inherit', env },
  )
  if (result.status !== 0) process.exit(result.status ?? 1)

  const webConfig = resolve(outDir, 'web.config')
  if (existsSync(webConfig)) {
    const text = readFileSync(webConfig, 'utf8').replace('url="/index.html"', `url="${remote.basePath}index.html"`)
    writeFileSync(webConfig, text)
  }
  console.log(`${remote.title} built → ${outDir} (served at ${remote.basePath})`)
}
if (failed) process.exit(1)
