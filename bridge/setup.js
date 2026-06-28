#!/usr/bin/env node
/**
 * One-time per-device setup for the flyer bridge:
 *   1. trust a local CA + issue a localhost cert (mkcert)
 *   2. generate the shared token (bridge/.token)
 *
 * Both outputs are gitignored. Re-running keeps an existing token.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const certDir = path.join(__dirname, 'cert')
const tokenPath = path.join(__dirname, '.token')

fs.mkdirSync(certDir, { recursive: true })

try {
  execFileSync('mkcert', ['-version'], { stdio: 'ignore' })
} catch {
  console.error('mkcert not found. Install it first:  brew install mkcert  (then re-run)')
  process.exit(1)
}

console.log('→ trusting local CA (mkcert -install)…')
execFileSync('mkcert', ['-install'], { stdio: 'inherit' })

console.log('→ issuing localhost cert…')
execFileSync(
  'mkcert',
  ['-cert-file', path.join(certDir, 'localhost.pem'), '-key-file', path.join(certDir, 'localhost-key.pem'), 'localhost'],
  { stdio: 'inherit' },
)

if (fs.existsSync(tokenPath) && fs.readFileSync(tokenPath, 'utf8').trim()) {
  console.log('→ token already present, keeping it.')
} else {
  fs.writeFileSync(tokenPath, crypto.randomBytes(24).toString('hex'))
  console.log('→ wrote bridge/.token')
}

console.log('\nDone. Start the bridge with:  npm start   (or register it in Claude — see ../docs/ai-bridge.md)')
