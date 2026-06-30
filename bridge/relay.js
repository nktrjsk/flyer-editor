#!/usr/bin/env node
/**
 * flyer-relay — the singleton half of the bridge.
 *
 * Owns the two things there can only be ONE of:
 *   1. the wss/ws relay ports (8787/8788) the editor tab dials into, and
 *   2. the live tab connection (newest tab wins).
 *
 * It also listens on a local unix socket where any number of MCP shims
 * (bridge/server.js, one per Claude client) connect and forward tool calls.
 * So: N Claude clients → N shims → 1 relay → 1 tab. No port can ever be
 * contended by two MCP faces — that was the old bug (a second client's
 * server.js hit EADDRINUSE and exit()ed, killing its own tools).
 *
 * Lifecycle: started DETACHED on demand by a shim, not tied to any client.
 * Self-exits when no shim has been connected for IDLE_MS, so a stale daemon
 * from an older code version can't linger — the next session spawns a fresh one.
 *
 * NEVER deployed. Local, per device. See ../docs/ai-bridge.md.
 * Detached → no stdout/stderr; logs go to .relay-<port>.log.
 */
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import http from 'node:http'
import https from 'node:https'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WSS_PORT = Number(process.env.FLYER_BRIDGE_PORT || 8787) // secure (https origins)
const WS_PORT = Number(process.env.FLYER_BRIDGE_WS_PORT || 8788) // plain (http dev origins)
const CERT_DIR = path.join(__dirname, 'cert')
const TOKEN_PATH = path.join(__dirname, '.token')
// Control socket + log are keyed by the wss port so a test daemon (8799) and
// the real one (8787) never share state.
const SOCK_PATH = path.join(__dirname, `.relay-${WSS_PORT}.sock`)
const LOG_PATH = path.join(__dirname, `.relay-${WSS_PORT}.log`)
const IDLE_MS = 30_000 // exit this long after the last shim disconnects

const logStream = fs.createWriteStream(LOG_PATH, { flags: 'a' })
const log = (...a) =>
  logStream.write(`[relay ${process.pid}] ${a.join(' ')}\n`)

// --- load cert + token (fatal if missing) ----------------------------------
let cert, key, token
try {
  cert = fs.readFileSync(path.join(CERT_DIR, 'localhost.pem'))
  key = fs.readFileSync(path.join(CERT_DIR, 'localhost-key.pem'))
} catch {
  log('FATAL: cert not found in bridge/cert/. Run:  npm run setup')
  process.exit(1)
}
try {
  token = fs.readFileSync(TOKEN_PATH, 'utf8').trim()
  if (!token) throw new Error('empty')
} catch {
  log('FATAL: bridge/.token missing or empty. Run:  npm run setup')
  process.exit(1)
}

// --- origin allowlist -------------------------------------------------------
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173', // vite dev
  'http://localhost:4173', // vite preview
  'https://nktrjsk.github.io', // GitHub Pages
])

// --- tab relay --------------------------------------------------------------
/** The single tab currently claiming the bridge (newest connection wins). */
let activeTab = null
/** tab-call id -> { shim, rid, timer }: routes the tab's reply back to a shim. */
const inflight = new Map()
let nextId = 1

// --- storm breaker ----------------------------------------------------------
// Two editor tabs (e.g. two browsers) both auto-connecting will each kick the
// other off the single "newest wins" slot ~1×/s forever. Up-to-date clients
// yield on the 4003 replace (see aiBridge.ts); this is the version-INDEPENDENT
// safety net for old/buggy clients. After too many replacements in a short
// window we go "sticky": reject new tabs at the HANDSHAKE — so they get no
// onopen and their reconnect backoff keeps growing instead of resetting — and
// hold whichever tab is currently active until it disconnects. Cleared when the
// active tab goes away, so a single fresh tab always connects normally.
const STORM_WINDOW_MS = 8_000
const STORM_THRESHOLD = 6
let replaceTimes = []
let sticky = false

function noteReplacement() {
  const now = Date.now()
  replaceTimes = replaceTimes.filter(t => now - t < STORM_WINDOW_MS)
  replaceTimes.push(now)
  if (!sticky && replaceTimes.length >= STORM_THRESHOLD) {
    sticky = true
    log(`STORM: ${replaceTimes.length} tab replacements in <${STORM_WINDOW_MS}ms — locking to current tab. Close the duplicate editor tab/browser.`)
  }
}

function verifyClient(info, cb) {
  const origin = info.origin || info.req.headers.origin
  let presented = null
  try {
    presented = new URL(info.req.url, 'https://localhost').searchParams.get('token')
  } catch {
    /* ignore */
  }
  if (!ALLOWED_ORIGINS.has(origin)) {
    log('reject handshake — origin not allowed:', origin)
    cb(false, 403, 'origin not allowed')
    return
  }
  if (presented !== token) {
    log('reject handshake — bad token from', origin)
    cb(false, 401, 'bad token')
    return
  }
  // Storm lock: keep the incumbent, bounce newcomers before the upgrade so they
  // never see onopen (no backoff reset). Self-releases when the incumbent drops.
  if (sticky && activeTab && activeTab.readyState === activeTab.OPEN) {
    log('reject handshake — storm lock active; keeping current tab. Close duplicate editor tabs.')
    cb(false, 503, 'bridge busy — another editor tab is connected; close duplicates')
    return
  }
  cb(true)
}

function handleTab(ws, req) {
  log('tab connected from', req.headers.origin)
  if (activeTab && activeTab !== ws && activeTab.readyState === activeTab.OPEN) {
    log('replacing previous active tab')
    noteReplacement()
    try { activeTab.close(4003, 'replaced by newer tab') } catch { /* ignore */ }
  }
  activeTab = ws

  ws.on('message', data => {
    let msg
    try { msg = JSON.parse(data.toString()) } catch { return }
    if (msg.type === 'hello') { log('tab hello'); return }
    if (msg.id != null && inflight.has(msg.id)) {
      const { shim, rid, timer } = inflight.get(msg.id)
      inflight.delete(msg.id)
      clearTimeout(timer)
      if (msg.error) replyShim(shim, rid, false, String(msg.error))
      else replyShim(shim, rid, true, msg.result)
    }
  })

  ws.on('close', () => {
    if (activeTab === ws) {
      activeTab = null
      // Incumbent gone — drop the storm lock so the next single tab connects normally.
      if (sticky) { sticky = false; replaceTimes = []; log('active tab closed — storm lock released') }
    }
    // Fail any calls that were waiting on this tab so shims don't hang.
    for (const [id, p] of [...inflight]) {
      inflight.delete(id)
      clearTimeout(p.timer)
      replyShim(p.shim, p.rid, false, 'Záložka editoru se odpojila během požadavku.')
    }
    log('tab disconnected')
  })
  ws.on('error', e => log('tab ws error:', e.message))
}

// Secure listener — for https origins (GitHub Pages). Needs the mkcert cert.
const httpsServer = https.createServer({ cert, key })
const wssSecure = new WebSocketServer({ server: httpsServer, verifyClient })
wssSecure.on('connection', handleTab)

// Plain listener — for http origins (local dev). ws://localhost is fine without
// a cert; still gated by the same origin allowlist + token, loopback only.
const httpServer = http.createServer()
const wsPlain = new WebSocketServer({ server: httpServer, verifyClient })
wsPlain.on('connection', handleTab)

// --- control socket (shims <-> relay) ---------------------------------------
// Line-delimited JSON. Shim → { t:'call', rid, tool, args, timeoutMs }.
// Relay → { t:'reply', rid, ok, result|error }.
const shims = new Set()
let idleTimer = null

function armIdleExit() {
  if (idleTimer) return
  idleTimer = setTimeout(() => {
    if (shims.size === 0) {
      log(`idle ${IDLE_MS}ms with no shims — exiting`)
      process.exit(0)
    }
  }, IDLE_MS)
  if (idleTimer.unref) idleTimer.unref()
}
function cancelIdleExit() {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
}

function replyShim(shim, rid, ok, payload) {
  if (!shim || shim.destroyed) return
  const msg = ok ? { t: 'reply', rid, ok: true, result: payload } : { t: 'reply', rid, ok: false, error: payload }
  try { shim.write(JSON.stringify(msg) + '\n') } catch { /* shim gone */ }
}

function forwardCall(shim, rid, tool, args, timeoutMs) {
  if (!activeTab || activeTab.readyState !== activeTab.OPEN) {
    replyShim(shim, rid, false, 'Žádná připojená záložka editoru. Otevři editor a klikni „Připojit k AI".')
    return
  }
  const id = nextId++
  const timer = setTimeout(() => {
    inflight.delete(id)
    replyShim(shim, rid, false, `Časový limit vypršel u nástroje „${tool}".`)
  }, timeoutMs || 30_000)
  inflight.set(id, { shim, rid, timer })
  try {
    activeTab.send(JSON.stringify({ id, tool, args }))
  } catch (e) {
    inflight.delete(id)
    clearTimeout(timer)
    replyShim(shim, rid, false, 'Nepodařilo se odeslat do záložky: ' + e.message)
  }
}

const controlServer = net.createServer(sock => {
  shims.add(sock)
  cancelIdleExit()
  log(`shim connected (${shims.size} active)`)
  let buf = ''
  sock.on('data', chunk => {
    buf += chunk.toString()
    let nl
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl)
      buf = buf.slice(nl + 1)
      if (!line) continue
      let msg
      try { msg = JSON.parse(line) } catch { continue }
      if (msg.t === 'call') forwardCall(sock, msg.rid, msg.tool, msg.args || {}, msg.timeoutMs)
    }
  })
  const drop = () => {
    if (!shims.has(sock)) return
    shims.delete(sock)
    log(`shim disconnected (${shims.size} active)`)
    if (shims.size === 0) armIdleExit()
  }
  sock.on('close', drop)
  sock.on('error', () => drop())
})

// --- boot -------------------------------------------------------------------
// The relay is a singleton: whoever binds the ports first wins. A late starter
// (e.g. two shims raced to spawn one) hits EADDRINUSE and exits 0 — the winner
// is already serving, and shims connect to ITS control socket. Bind the ports
// BEFORE touching the control socket so a loser never disturbs the winner's sock.
function onBootError(label, e) {
  if (e && e.code === 'EADDRINUSE') {
    log(`ports ${WS_PORT}/${WSS_PORT} already owned — another relay is serving; exiting`)
    process.exit(0)
  }
  log(`FATAL: ${label} error:`, e && e.message)
  process.exit(1)
}
httpsServer.on('error', e => onBootError('https', e))
httpServer.on('error', e => onBootError('http', e))
wssSecure.on('error', e => onBootError('wss', e))
wsPlain.on('error', e => onBootError('ws', e))

let portsUp = 0
function startControlSocket(retried) {
  controlServer.once('error', e => {
    if (e.code === 'EADDRINUSE' && !retried) {
      // Stale socket file from a dead relay — remove it and retry once.
      try { fs.unlinkSync(SOCK_PATH) } catch { /* ignore */ }
      startControlSocket(true)
      return
    }
    onBootError('control', e)
  })
  controlServer.listen(SOCK_PATH, () => {
    log(`control socket listening on ${SOCK_PATH}`)
    armIdleExit() // no shims yet; if none arrive, don't linger
  })
}
function onPortUp() {
  if (++portsUp === 2) {
    try { if (fs.existsSync(SOCK_PATH)) fs.unlinkSync(SOCK_PATH) } catch { /* ignore */ }
    startControlSocket(false)
  }
}
httpsServer.listen(WSS_PORT, '127.0.0.1', () => { log(`wss relay on ${WSS_PORT}`); onPortUp() })
httpServer.listen(WS_PORT, '127.0.0.1', () => { log(`ws relay on ${WS_PORT}`); onPortUp() })

process.on('exit', () => { try { fs.unlinkSync(SOCK_PATH) } catch { /* ignore */ } })
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
