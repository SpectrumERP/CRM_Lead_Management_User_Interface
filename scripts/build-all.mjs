#!/usr/bin/env node
/** Build CRM and every configured remote with one Vite mode (e.g. development, uat, production). */
import { spawnSync } from 'node:child_process'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const modeIndex = process.argv.indexOf('--mode')
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : 'production'

if (!mode || mode.startsWith('--')) {
  console.error('Usage: npm run build:all -- --mode <mode>')
  process.exit(2)
}

for (const script of ['build', 'build:remotes']) {
  const result = spawnSync(npm, ['run', script, '--', '--mode', mode], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
