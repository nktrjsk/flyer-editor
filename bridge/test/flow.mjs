#!/usr/bin/env node
/**
 * Full proposal-flow probe: propose_changes → await_decision → get_state.
 * Run in the background, then click Přijmout/Zamítnout in the editor; this
 * prints the decision the human made and the resulting live state.
 *
 * Usage:  node test/flow.mjs [proposeArgsJson]
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const proposeArgs = process.argv[2]
  ? JSON.parse(process.argv[2])
  : { title: 'Upraveno AI', markdown: '## Nový obsah\n\nKrátký text navržený AI.\n\nDruhý odstavec.' }

const transport = new StdioClientTransport({ command: 'node', args: ['server.js'], cwd: root, stderr: 'inherit' })
const client = new Client({ name: 'flow', version: '0.0.0' }, { capabilities: {} })
await client.connect(transport)

const text = r => r.content.map(c => c.text).join('')

// wait for tab
for (let i = 0; i < 30; i++) {
  const r = await client.callTool({ name: 'get_state', arguments: {} })
  if (!r.isError) break
  await new Promise(res => setTimeout(res, 2000))
}

console.log('→ propose_changes', JSON.stringify(proposeArgs))
const staged = await client.callTool({ name: 'propose_changes', arguments: proposeArgs })
console.log('  result:', text(staged))

console.log('→ await_decision (blocks until you click in the editor)…')
const decision = await client.callTool({ name: 'await_decision', arguments: {} })
console.log('  DECISION:', text(decision))

const after = await client.callTool({ name: 'get_state', arguments: {} })
const state = JSON.parse(text(after))
console.log('→ get_state after decision:')
console.log('  title:', JSON.stringify(state.meta.title))
console.log('  markdown head:', JSON.stringify(state.markdown.slice(0, 60)))

await client.close()
process.exit(0)
