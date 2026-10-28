#!/usr/bin/env node
/**
 * Builds every remote app in microfrontends.json into dist/<basePath> with that base (run after the CRM
 * build, which empties dist), then writes the IIS web.config for the CRM and for each remote, so every
 * app gets the same routing fallback and cache headers whether or not its repository ships one.
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { remoteApps, remoteEnv } from './microfrontends.mjs'

const root = resolve(import.meta.dirname, '..')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const modeIndex = process.argv.indexOf('--mode')
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : 'production'
const env = remoteEnv(root, mode)

const noCache = (path) => `  <location path="${path}">
    <system.webServer>
      <staticContent>
        <clientCache cacheControlMode="DisableCache" />
      </staticContent>
    </system.webServer>
  </location>`

/**
 * IIS config for one single-page app served at the folder it is written to.
 * - Client-side routes (a reload of /task/task/74) rewrite to `indexUrl`; `skip` lists URL patterns
 *   left to a nested app's own web.config.
 * - A nested folder inherits the parent's rewrite rules: `<clear />` drops the CRM's rules there, and
 *   each app's rule has its own `name` (a duplicate name is a config error — every request 500s).
 * - A missing build file stays a 404: an old page asking for last deploy's CSS/JS must not get
 *   index.html in its place (loaded as a stylesheet it leaves the page unstyled).
 * - index.html (and the Task app's sw.js / version.json) is revalidated on every load, since it names
 *   the current build's files; /assets is cached for a year, its file names change with every build.
 */
function spaWebConfig(name, indexUrl, skip = []) {
  return `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <clear />
        <rule name="${name} SPA Routing" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{URL}" pattern="/assets/" negate="true" />
${skip.map((pattern) => `            <add input="{URL}" pattern="${pattern}" negate="true" />`).join('\n')}
          </conditions>
          <action type="Rewrite" url="${indexUrl}" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <remove fileExtension=".webmanifest" />
      <mimeMap fileExtension=".webmanifest" mimeType="application/manifest+json" />
      <remove fileExtension=".json" />
      <mimeMap fileExtension=".json" mimeType="application/json" />
    </staticContent>
  </system.webServer>
${['index.html', 'sw.js', 'version.json'].map(noCache).join('\n')}
  <location path="assets">
    <system.webServer>
      <staticContent>
        <clientCache cacheControlMode="UseMaxAge" cacheControlMaxAge="365.00:00:00" />
      </staticContent>
    </system.webServer>
  </location>
</configuration>
`
}

const folderOf = (remote) => remote.basePath.replace(/^\/+|\/+$/g, '')

let failed = false
for (const remote of remoteApps(root, mode)) {
  if (!remote.dir) {
    console.error(`${remote.title} not found (set ${remote.dirEnv} in .env to its checkout) — not built.`)
    failed = true
    continue
  }
  const outDir = resolve(root, 'dist', folderOf(remote))
  const result = spawnSync(
    npm,
    ['--prefix', remote.dir, 'run', 'build', '--', '--mode', mode, '--base', remote.basePath, '--outDir', outDir, '--emptyOutDir'],
    { cwd: root, stdio: 'inherit', env },
  )
  if (result.status !== 0) process.exit(result.status ?? 1)

  writeFileSync(resolve(outDir, 'web.config'), spaWebConfig(remote.title, `${remote.basePath}index.html`))
  console.log(`${remote.title} built → ${outDir} (served at ${remote.basePath})`)
}
if (failed) process.exit(1)

// CRM is hosted at the domain root. Send its client-side routes (for example /login) to the
// CRM entry point, while leaving each remote's routes (/task, /documentsmanagement) to its own nested
// IIS configuration.
writeFileSync(
  resolve(root, 'dist', 'web.config'),
  spaWebConfig('CRM', '/index.html', remoteApps(root, mode).map((remote) => `^/${folderOf(remote)}(/|$)`)),
)
console.log('CRM IIS SPA fallback written → dist/web.config')
