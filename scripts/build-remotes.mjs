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
const modeIndex = process.argv.indexOf('--mode')
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : 'production'
const env = remoteEnv(root, mode)

let failed = false
for (const remote of remoteApps(root, mode)) {
  if (!remote.dir) {
    console.error(`${remote.title} not found (set ${remote.dirEnv} in .env to its checkout) — not built.`)
    failed = true
    continue
  }
  const outDir = resolve(root, 'dist', remote.basePath.replace(/^\/+|\/+$/g, ''))
  const result = spawnSync(
    npm,
    ['--prefix', remote.dir, 'run', 'build', '--', '--mode', mode, '--base', remote.basePath, '--outDir', outDir, '--emptyOutDir'],
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

// CRM is hosted at the domain root. Send its client-side routes (for example /login) to the
// CRM entry point, while leaving /task routes to the Task app's own nested IIS configuration.
writeFileSync(
  resolve(root, 'dist', 'web.config'),
  `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="CRM SPA Routing" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{URL}" pattern="^/task(/|$)" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
`,
)
console.log('CRM IIS SPA fallback written → dist/web.config')
