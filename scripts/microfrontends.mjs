/**
 * The micro-frontend manifest (microfrontends.json) for the Node scripts: the remote apps and where
 * each one is checked out. Every remote is its own repository outside this one, found through its
 * `dirEnv` (environment or the CRM's .env; absolute or relative to the CRM root), else the first of
 * its `fallbackDirs` that has a package.json.
 */
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { loadEnv } from 'vite'

export function loadManifest(root) {
  return JSON.parse(readFileSync(resolve(root, 'microfrontends.json'), 'utf8'))
}

function findDir(root, remote, env) {
  const configured = process.env[remote.dirEnv] || env[remote.dirEnv]
  const candidates = configured ? [configured] : (remote.fallbackDirs ?? [])
  for (const dir of candidates) {
    const abs = isAbsolute(dir) ? dir : resolve(root, dir)
    if (existsSync(resolve(abs, 'package.json'))) return abs
  }
  if (configured) console.warn(`${remote.dirEnv}="${configured}" has no package.json.`)
  return null
}

/** Remote apps with `dir` set to their checkout (null when not found). */
export function remoteApps(root, mode = 'development') {
  const manifest = loadManifest(root)
  const env = loadEnv(mode, root, '')
  return manifest.remotes.map((remote) => ({ ...remote, dir: findDir(root, remote, env) }))
}

/** Env for a remote's dev server / build: the CRM cookie secret under the name the remote reads. */
export function remoteEnv(root, mode = 'development') {
  const { session } = loadManifest(root)
  const env = loadEnv(mode, root, '')
  const secret = env[session.secretEnv]
  const remoteEnv = { ...process.env }
  if (secret) remoteEnv[session.remoteSecretEnv] = secret
  // Public routing config must follow the selected CRM build mode into remote bundles.
  for (const key of ['VITE_CRM_LOGIN_URL', 'VITE_TASK_PUBLIC_URL', 'VITE_COOKIE_DOMAIN']) {
    if (process.env[key] || env[key]) remoteEnv[key] = process.env[key] || env[key]
  }
  if (remoteEnv.VITE_COOKIE_DOMAIN) remoteEnv.VITE_CRM_COOKIE_DOMAIN = remoteEnv.VITE_COOKIE_DOMAIN
  return remoteEnv
}
