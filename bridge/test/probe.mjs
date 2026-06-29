#!/usr/bin/env node
/**
 * Live integration probe — spawns the real bridge as an MCP subprocess, then
 * repeatedly calls a tool until the browser tab connects, prints the result.
 *
 * Usage:  node test/probe.mjs <tool> [jsonArgs]
 *   node test/probe.mjs get_state
 *   node test/probe.mjs list_concepts
 *   node test/probe.mjs propose_changes '{"title":"Ahoj"}'
 *   node test/probe.mjs await_decision        # blocks on the human
 *
 * Owns the only server instance on the default port — don't run a standalone
 * bridge at the same time.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const tool = process.argv[2] || 'get_state'
const args = process.argv[3] ? JSON.parse(process.argv[3]) : {}
const ATTEMPTS = 30

const transport = new StdioClientTransport({
  command: 'node',
  args: ['server.js'],
  cwd: root,
  stderr: 'inherit',
})
const client = new Client({ name: 'probe', version: '0.0.0' }, { capabilities: {} })
await client.connect(transport)

const tools = (await client.listTools()).tools.map(t => t.name)
console.error('tools:', tools.join(', '))

let result = null
for (let i = 0; i < ATTEMPTS; i++) {
  const r = await client.callTool({ name: tool, arguments: args })
  if (!r.isError) { result = r; break }
  process.stderr.write(`waiting for tab (${i + 1}/${ATTEMPTS})… ${r.content[0].text}\n`)
  await new Promise(res => setTimeout(res, 2000))
}

if (!result) {
  console.error('NO TAB CONNECTED — is the editor open with AI enabled?')
  await client.close()
  process.exit(1)
}

console.log(`=== ${tool} ===`)
for (const c of result.content) {
  if (c.type === 'text') console.log(c.text)
  else if (c.type === 'image') {
    const outPath = '/tmp/flyer-shot.png'
    fs.writeFileSync(outPath, Buffer.from(c.data, 'base64'))
    console.log(`[image ${c.mimeType}, ${c.data.length} base64 chars] → saved ${outPath}`)
  }
}
await client.close()
process.exit(0)
