#!/usr/bin/env node
/**
 * Self-test harness for the bridge — no browser, no Claude required.
 *
 * Spawns server.js via a real MCP stdio client (the SDK's Client), connects a
 * fake "tab" over wss, and exercises the full round-trip:
 *   MCP client → bridge (stdio) → relay → tab (wss) → reply → back to client.
 *
 * Also checks the security gate (bad token / bad origin are rejected).
 *
 * Run:  node test/harness.mjs   (from bridge/, after npm run setup)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const PORT = 8799 // dedicated test port, avoids clashing with a running bridge
const token = fs.readFileSync(path.join(root, '.token'), 'utf8').trim()
const WSS = `wss://localhost:${PORT}/?token=${token}`

let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✅', msg) } else { fail++; console.log('  ❌', msg) } }

// A fake editor tab: connects over wss and echoes every tool call.
function fakeTab(origin = 'http://localhost:5173', tkn = token) {
  const ws = new WebSocket(`wss://localhost:${PORT}/?token=${tkn}`, {
    rejectUnauthorized: false, // localhost self-test; real browser trusts the mkcert CA
    headers: { origin },
  })
  ws.on('open', () => ws.send(JSON.stringify({ type: 'hello' })))
  ws.on('message', d => {
    const m = JSON.parse(d.toString())
    if (m.id == null) return
    // echo back what we received so the client can assert the relay worked
    ws.send(JSON.stringify({ id: m.id, result: { echo: m.tool, args: m.args } }))
  })
  return ws
}

async function main() {
  // Start the bridge as a real MCP subprocess.
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['server.js'],
    cwd: root,
    env: { ...process.env, FLYER_BRIDGE_PORT: String(PORT) },
    stderr: 'inherit',
  })
  const client = new Client({ name: 'harness', version: '0.0.0' }, { capabilities: {} })
  await client.connect(transport)
  console.log('MCP connected.')

  // 1. tools enumerate
  const { tools } = await client.listTools()
  const names = tools.map(t => t.name).sort()
  ok(tools.length === 6, `listTools returns 6 tools (${tools.length})`)
  ok(['await_decision', 'get_screenshot', 'get_state', 'list_concepts', 'propose_changes', 'switch_concept'].every(n => names.includes(n)),
    `tool names complete: ${names.join(', ')}`)

  // 2. no tab connected → tool call returns a friendly error
  const noTab = await client.callTool({ name: 'get_state', arguments: {} })
  ok(noTab.isError === true, 'get_state with no tab → isError')
  ok(/Připojit k AI/.test(noTab.content[0].text), 'error tells user to connect a tab')

  // 3. connect a tab, round-trip a call
  const tab = fakeTab()
  await new Promise(r => tab.once('open', r))
  await new Promise(r => setTimeout(r, 100))
  const res = await client.callTool({ name: 'list_concepts', arguments: {} })
  const payload = JSON.parse(res.content[0].text)
  ok(payload.echo === 'list_concepts', 'list_concepts relayed to tab and echoed back')

  const res2 = await client.callTool({ name: 'propose_changes', arguments: { title: 'Hello' } })
  const payload2 = JSON.parse(res2.content[0].text)
  ok(payload2.args.title === 'Hello', 'propose_changes args relayed intact')

  // The gate rejects at the handshake (HTTP 401/403) — the socket must never open.
  const expectRejected = (url, origin) => new Promise(resolve => {
    const ws = new WebSocket(url, { rejectUnauthorized: false, headers: { origin } })
    ws.on('open', () => { ws.close(); resolve('opened') })
    ws.on('error', () => resolve('rejected'))
    ws.on('unexpected-response', (_req, res) => resolve('rejected:' + res.statusCode))
  })

  // 4. security: bad token rejected
  const badToken = await expectRejected(`wss://localhost:${PORT}/?token=WRONG`, 'http://localhost:5173')
  ok(badToken.startsWith('rejected'), `bad token rejected at handshake (${badToken})`)

  // 5. security: bad origin rejected
  const badOrigin = await expectRejected(`wss://localhost:${PORT}/?token=${token}`, 'https://evil.example')
  ok(badOrigin.startsWith('rejected'), `bad origin rejected at handshake (${badOrigin})`)

  tab.close()
  await client.close()
  console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'} — ${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(e => { console.error('harness error:', e); process.exit(1) })
