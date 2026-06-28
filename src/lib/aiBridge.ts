/**
 * App-side client for the local AI bridge (see bridge/server.js, docs/ai-bridge.md).
 *
 * The tab dials OUT to wss://localhost:PORT. The bridge forwards each MCP tool
 * call as {id, tool, args}; we run the registered dispatcher and reply
 * {id, result} | {id, error}. Singleton: one socket per tab, survives React
 * re-renders and Strict Mode double-invocation.
 *
 * If the bridge isn't running the app behaves normally — status just stays
 * 'disconnected' and it retries with backoff.
 */
// An https page (GitHub Pages) must use wss (mixed-content rule); an http page
// (local dev) uses plain ws — no cert needed. The bridge listens on both.
const WSS_PORT = 8787
const WS_PORT = 8788

function bridgeUrl(token: string): string {
  const secure = location.protocol === 'https:'
  const scheme = secure ? 'wss' : 'ws'
  const port = secure ? WSS_PORT : WS_PORT
  return `${scheme}://localhost:${port}/?token=${encodeURIComponent(token)}`
}

export const AI_TOKEN_KEY = 'flyer.aiToken'
export const AI_ENABLED_KEY = 'flyer.aiEnabled'

export type BridgeStatus = 'disconnected' | 'connecting' | 'connected'
export type ToolDispatcher = (tool: string, args: Record<string, unknown>) => Promise<unknown> | unknown

let ws: WebSocket | null = null
let dispatcher: ToolDispatcher | null = null
let status: BridgeStatus = 'disconnected'
let shouldConnect = false
let token = ''
let backoffMs = 1000
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

const statusListeners = new Set<(s: BridgeStatus) => void>()

function setStatus(s: BridgeStatus) {
  if (s === status) return
  status = s
  statusListeners.forEach(l => l(s))
}

/** Register the function that handles incoming tool calls. */
export function setBridgeDispatcher(fn: ToolDispatcher) {
  dispatcher = fn
}

/**
 * Dev-only test seam: invoke the registered dispatcher directly, bypassing the
 * socket. Used by verification when the sandboxed test browser can't reach the
 * local bridge. Not wired up in production builds.
 */
export function devInvoke(tool: string, args: Record<string, unknown>): Promise<unknown> {
  if (!dispatcher) return Promise.reject(new Error('no dispatcher registered'))
  return Promise.resolve(dispatcher(tool, args))
}

export function onBridgeStatus(cb: (s: BridgeStatus) => void): () => void {
  statusListeners.add(cb)
  cb(status)
  return () => statusListeners.delete(cb)
}

export function getBridgeStatus(): BridgeStatus {
  return status
}

// --- enable/disable (persisted) ---------------------------------------------
// One path shared by the auto-connect hook and the toolbar control.
export function savedToken(): string {
  return localStorage.getItem(AI_TOKEN_KEY) ?? ''
}
export function isEnabled(): boolean {
  return localStorage.getItem(AI_ENABLED_KEY) === 'true'
}
export function enableBridge(token: string) {
  const t = token.trim()
  localStorage.setItem(AI_TOKEN_KEY, t)
  localStorage.setItem(AI_ENABLED_KEY, 'true')
  connectBridge(t)
}
export function disableBridge() {
  localStorage.setItem(AI_ENABLED_KEY, 'false')
  disconnectBridge()
}

export function connectBridge(t: string) {
  token = t
  shouldConnect = true
  openSocket()
}

export function disconnectBridge() {
  shouldConnect = false
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  const sock = ws
  ws = null
  if (sock) sock.close()
  setStatus('disconnected')
}

function scheduleReconnect() {
  if (reconnectTimer || !shouldConnect) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (shouldConnect) openSocket()
  }, backoffMs)
  backoffMs = Math.min(backoffMs * 2, 15_000)
}

function openSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
  setStatus('connecting')

  let sock: WebSocket
  try {
    sock = new WebSocket(bridgeUrl(token))
  } catch {
    setStatus('disconnected')
    scheduleReconnect()
    return
  }
  ws = sock

  sock.onopen = () => {
    backoffMs = 1000
    setStatus('connected')
    sock.send(JSON.stringify({ type: 'hello' }))
  }

  sock.onmessage = async ev => {
    let msg: { id?: number; tool?: string; args?: Record<string, unknown> }
    try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '') } catch { return }
    if (msg.id == null || !msg.tool) return
    try {
      if (!dispatcher) throw new Error('Editor není připraven.')
      const result = await dispatcher(msg.tool, msg.args || {})
      sock.send(JSON.stringify({ id: msg.id, result }))
    } catch (e) {
      sock.send(JSON.stringify({ id: msg.id, error: e instanceof Error ? e.message : String(e) }))
    }
  }

  sock.onclose = () => {
    if (ws === sock) ws = null
    setStatus('disconnected')
    scheduleReconnect()
  }

  // onerror is followed by onclose; let onclose drive reconnect.
  sock.onerror = () => {}
}
