#!/usr/bin/env node
/**
 * flyer-bridge (MCP shim) — the per-client half of the bridge.
 *
 * Claude (Desktop / Code) spawns ONE of these over stdio per client. It does
 * NOT own any port: it ensures the singleton relay (relay.js) is running —
 * spawning it detached if needed — and forwards every MCP tool call to it over
 * a local unix socket. The relay forwards to the editor tab and routes the
 * reply back here.
 *
 * Why split: the old design made this same process also bind the relay ports.
 * A second client then hit EADDRINUSE and exit()ed, taking its own MCP tools
 * down with it. A shim can't collide with anything, so every client always
 * gets working tools. See relay.js + ../docs/ai-bridge.md.
 *
 * IMPORTANT: stdout is the MCP JSON-RPC channel. All logging goes to stderr.
 */
import net from 'node:net'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WSS_PORT = Number(process.env.FLYER_BRIDGE_PORT || 8787)
const SOCK_PATH = path.join(__dirname, `.relay-${WSS_PORT}.sock`)
const RELAY_PATH = path.join(__dirname, 'relay.js')

const log = (...a) => process.stderr.write('[flyer-bridge] ' + a.join(' ') + '\n')

// --- control connection to the relay ----------------------------------------
let conn = null
let buf = ''
let nextRid = 1
const pending = new Map() // rid -> { resolve, timer }

function failAllPending(reason) {
  for (const [rid, p] of [...pending]) {
    pending.delete(rid)
    clearTimeout(p.timer)
    p.resolve({ ok: false, error: reason })
  }
}

function attach(sock) {
  conn = sock
  buf = ''
  sock.on('data', chunk => {
    buf += chunk.toString()
    let nl
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl)
      buf = buf.slice(nl + 1)
      if (!line) continue
      let msg
      try { msg = JSON.parse(line) } catch { continue }
      if (msg.t === 'reply' && pending.has(msg.rid)) {
        const p = pending.get(msg.rid)
        pending.delete(msg.rid)
        clearTimeout(p.timer)
        p.resolve(msg)
      }
    }
  })
  sock.on('close', () => { if (conn === sock) conn = null; failAllPending('Spojení s relayem se přerušilo.') })
  sock.on('error', () => { /* close follows */ })
}

function tryConnect() {
  return new Promise(resolve => {
    const sock = net.connect(SOCK_PATH)
    sock.once('connect', () => { attach(sock); resolve(true) })
    sock.once('error', () => resolve(false))
  })
}

let lastSpawn = 0
function spawnDaemon() {
  // Allow respawning a daemon that has died, but don't fire on every failed
  // retry during one outage — a 3s cooldown is plenty. Extra daemons are
  // harmless: the loser EADDRINUSE-exits.
  const now = Date.now()
  if (now - lastSpawn < 3000) return
  lastSpawn = now
  log('starting relay daemon')
  const child = spawn(process.execPath, [RELAY_PATH], {
    detached: true,
    stdio: 'ignore',
    cwd: __dirname,
    env: process.env, // pass FLYER_BRIDGE_PORT etc. through to the daemon
  })
  child.unref()
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

/** Ensure we have a live control connection; spawn the daemon if none exists. */
async function ensureConn() {
  if (conn && !conn.destroyed) return true
  if (await tryConnect()) return true
  spawnDaemon()
  for (let i = 0; i < 40; i++) { // ~6s of 150ms tries
    await sleep(150)
    if (await tryConnect()) return true
  }
  log('could not reach relay daemon')
  return false
}

/** Forward one tool call to the relay; resolves to { ok, result|error }. */
async function callRelay(tool, args, timeoutMs) {
  if (!(await ensureConn())) {
    return { ok: false, error: 'Nepodařilo se spustit/oslovit relay (zkontroluj bridge/.relay-*.log).' }
  }
  const rid = nextRid++
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      pending.delete(rid)
      resolve({ ok: false, error: `Časový limit u nástroje „${tool}".` })
    }, timeoutMs + 5_000) // safety net beyond the relay's own per-call timeout
    pending.set(rid, { resolve, timer })
    try {
      conn.write(JSON.stringify({ t: 'call', rid, tool, args, timeoutMs }) + '\n')
    } catch (e) {
      pending.delete(rid)
      clearTimeout(timer)
      resolve({ ok: false, error: 'Zápis do relaye selhal: ' + e.message })
    }
  })
}

// --- MCP tool surface (unchanged) -------------------------------------------
const TOOLS = [
  {
    name: 'get_state',
    description:
      'Vrátí aktuální (i neuložený) stav editoru: meta, markdown, počet stránek, ' +
      'přetečení, barevnost, zda má logo. Toto je zdroj pravdy — obrázek z get_screenshot je jen přibližný.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_concepts',
    description: 'Seznam všech letáků (konceptů): [{ id, title }].',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_screenshot',
    description:
      'Přibližný PNG náhled vykreslené stránky (.page). Pozor: webové fonty, CSS filtry ' +
      'a logo se mohou vykreslit mírně jinak — neber jako pixelovou pravdu.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'propose_changes',
    description:
      'Navrhne úpravu aktivního letáku. Standardně NEZAPISUJE — uživatel ji potvrdí v editoru ' +
      '(vrátí "staged"). Má-li uživatel zapnutý režim automatického přijímání, úprava se použije ' +
      'rovnou (vrátí "auto-accepted") a await_decision není potřeba. ' +
      'Předchozí nepotvrzený návrh je nahrazen. Vrať jen pole, která chceš změnit. ' +
      'org/web/rok jsou automatické (Nastavení + datum úpravy) a navrhnout je nelze.',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: { type: 'string', description: 'Celý nový markdown těla letáku.' },
        title: { type: 'string' },
        fontSize: { type: 'number', description: 'Velikost písma v pt (např. 9.5).' },
        palette: { type: 'string', enum: ['color', 'bw'], description: 'Barevně nebo černobíle.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'create_concept',
    description:
      'Navrhne vytvoření NOVÉHO letáku (konceptu) s volitelným obsahem a metadaty. ' +
      'NEVYTVÁŘÍ přímo — uživatel potvrdí v editoru; po potvrzení se nový leták rovnou otevře. ' +
      'Vrať jen pole, která chceš nastavit; nezadaná zůstanou prázdná (písmo 9.5, barevně). ' +
      'org/web/rok jsou automatické (Nastavení + datum úpravy).',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: { type: 'string', description: 'Markdown těla nového letáku.' },
        title: { type: 'string' },
        fontSize: { type: 'number', description: 'Velikost písma v pt (např. 9.5).' },
        palette: { type: 'string', enum: ['color', 'bw'], description: 'Barevně nebo černobíle.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'switch_concept',
    description:
      'Navrhne přepnutí na jiný leták (koncept) podle id. NEPŘEPÍNÁ přímo — uživatel potvrdí.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'id konceptu z list_concepts.' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'await_decision',
    description:
      'Blokuje, dokud uživatel návrh nepotvrdí nebo nezamítne, pak vrátí { accepted, reason? }. ' +
      'Po ~5 min vrátí { status: "pending" } — pak zavolej znovu. Takto se dozvíš výsledek recenze.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
]

const mcp = new Server(
  { name: 'flyer', version: '0.2.0' },
  { capabilities: { tools: {} } },
)

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

mcp.setRequestHandler(CallToolRequestSchema, async req => {
  const name = req.params.name
  const args = req.params.arguments || {}
  // await_decision blocks on a human; give it a long leash. The tab self-caps
  // at ~5 min and returns { status: "pending" } before this fires.
  const timeoutMs = name === 'await_decision' ? 55_000 : 30_000
  const reply = await callRelay(name, args, timeoutMs)
  if (!reply.ok) {
    return { content: [{ type: 'text', text: 'Chyba: ' + reply.error }], isError: true }
  }
  const result = reply.result
  if (name === 'get_screenshot' && result && result.base64) {
    return {
      content: [{ type: 'image', data: result.base64, mimeType: result.mimeType || 'image/png' }],
    }
  }
  const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
  return { content: [{ type: 'text', text }] }
})

// --- boot -------------------------------------------------------------------
// Bring the daemon up first so the tab has something to dial before we announce
// tools — then connect the MCP stdio channel. Daemon trouble is non-fatal: tools
// still list and calls return a clear error.
await ensureConn().catch(() => {})
await mcp.connect(new StdioServerTransport())
log('MCP shim ready on stdio')
