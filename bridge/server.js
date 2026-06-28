#!/usr/bin/env node
/**
 * flyer-bridge — local MCP server + wss relay.
 *
 * Two faces, one process:
 *   1. MCP server over stdio  → talks to Claude (Desktop / Code).
 *   2. wss relay server       → the editor tab dials in over wss://localhost.
 *
 * It is a DUMB RELAY: each MCP tool call is forwarded verbatim to the active
 * tab as {id, tool, args}; the tab replies {id, result} | {id, error}. All real
 * logic (diffing, gating, snapshots) lives in the app.
 *
 * NEVER deployed. Runs locally, per device. See ../docs/ai-bridge.md.
 *
 * IMPORTANT: stdout is the MCP JSON-RPC channel. All logging goes to stderr.
 */
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.FLYER_BRIDGE_PORT || 8787)
const CERT_DIR = path.join(__dirname, 'cert')
const TOKEN_PATH = path.join(__dirname, '.token')

// stdout belongs to MCP — log only to stderr.
const log = (...a) => process.stderr.write('[flyer-bridge] ' + a.join(' ') + '\n')

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
// Only these pages may drive the bridge. Derived from the repo's deploy target
// (https://nktrjsk.github.io/flyer-editor/) plus local dev/preview.
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173', // vite dev
  'http://localhost:4173', // vite preview
  'https://nktrjsk.github.io', // GitHub Pages
])

// --- wss relay --------------------------------------------------------------
const httpsServer = https.createServer({ cert, key })

// Gate at the handshake: unauthorized pages get an HTTP error and never get an
// open socket at all (cleaner than accepting then closing).
const wss = new WebSocketServer({
  server: httpsServer,
  verifyClient: (info, cb) => {
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
    cb(true)
  },
})

/** The single tab currently claiming the bridge (newest connection wins). */
let activeTab = null
/** id -> { resolve, reject, timer } for in-flight tool calls awaiting a reply. */
const pending = new Map()
let nextId = 1

// Only authorized connections reach here (verifyClient gates the rest).
wss.on('connection', (ws, req) => {
  const origin = req.headers.origin
  log('tab connected from', origin)
  // Newest connection becomes the active tab; drop the previous one cleanly.
  if (activeTab && activeTab !== ws && activeTab.readyState === activeTab.OPEN) {
    log('replacing previous active tab')
    try { activeTab.close(4003, 'replaced by newer tab') } catch { /* ignore */ }
  }
  activeTab = ws

  ws.on('message', data => {
    let msg
    try { msg = JSON.parse(data.toString()) } catch { return }
    if (msg.type === 'hello') { log('tab hello'); return }
    if (msg.id != null && pending.has(msg.id)) {
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      clearTimeout(p.timer)
      if (msg.error) p.reject(new Error(String(msg.error)))
      else p.resolve(msg.result)
    }
  })

  ws.on('close', () => {
    if (activeTab === ws) activeTab = null
    log('tab disconnected')
  })
  ws.on('error', e => log('ws error:', e.message))
})

/** Forward a tool call to the active tab and await its reply. */
function callTab(tool, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (!activeTab || activeTab.readyState !== activeTab.OPEN) {
      reject(new Error('Žádná připojená záložka editoru. Otevři editor a klikni „Připojit k AI".'))
      return
    }
    const id = nextId++
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`Časový limit vypršel u nástroje „${tool}".`))
    }, timeoutMs)
    pending.set(id, { resolve, reject, timer })
    activeTab.send(JSON.stringify({ id, tool, args }))
  })
}

// --- MCP server -------------------------------------------------------------
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
      'Navrhne úpravu aktivního letáku. NEZAPISUJE — uživatel ji musí potvrdit v editoru. ' +
      'Předchozí nepotvrzený návrh je nahrazen. Vrať jen pole, která chceš změnit.',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: { type: 'string', description: 'Celý nový markdown těla letáku.' },
        title: { type: 'string' },
        org: { type: 'string' },
        year: { type: 'string' },
        web: { type: 'string' },
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
  { name: 'flyer', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

mcp.setRequestHandler(CallToolRequestSchema, async req => {
  const name = req.params.name
  const args = req.params.arguments || {}
  // await_decision blocks on a human; give it a long leash. The tab self-caps
  // at ~5 min and returns { status: "pending" } before this fires.
  const timeoutMs = name === 'await_decision' ? 320_000 : 30_000
  try {
    const result = await callTab(name, args, timeoutMs)
    if (name === 'get_screenshot' && result && result.base64) {
      return {
        content: [{ type: 'image', data: result.base64, mimeType: result.mimeType || 'image/png' }],
      }
    }
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
    return { content: [{ type: 'text', text }] }
  } catch (e) {
    return { content: [{ type: 'text', text: 'Chyba: ' + e.message }], isError: true }
  }
})

// --- boot -------------------------------------------------------------------
httpsServer.listen(PORT, '127.0.0.1', () => log(`wss relay listening on wss://localhost:${PORT}`))
httpsServer.on('error', e => { log('FATAL: https server error:', e.message); process.exit(1) })

await mcp.connect(new StdioServerTransport())
log('MCP server ready on stdio')
