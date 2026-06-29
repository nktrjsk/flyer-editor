# flyer-bridge

Local MCP server that lets **your own Claude** (Desktop or Code) read, see, and
**propose** edits to the live flyer-editor tab. Every change stays gated behind
your explicit Accept/Reject in the editor.

**This never deploys.** It runs locally, per device. The published app is just
static files; this is a Node process on your machine that the editor tab dials
into. Full design: [`../docs/ai-bridge.md`](../docs/ai-bridge.md).

## How it works (two processes)

The bridge is split so multiple Claude clients can't fight over one port:

- **`relay.js`** — the **singleton daemon**. Owns the relay ports (8787/8788)
  and the editor-tab connection, plus a local control socket. Auto-started on
  demand, shared by everyone, and self-exits ~30 s after the last client leaves
  (so a stale daemon from old code can't linger).
- **`server.js`** — a thin **MCP shim**, one per Claude client. Binds no ports;
  it ensures the daemon is up (spawning it if needed) and forwards tool calls
  over the control socket.

So N Claude clients → N shims → 1 daemon → 1 tab. A second client can never kill
the first's tools — the failure mode this split exists to remove. If tools ever
go missing, just reconnect the `flyer` server in your client (or `/mcp` in
Claude Code); the shim respawns the daemon. Daemon logs: `bridge/.relay-8787.log`.

## One-time setup

```bash
cd bridge
npm install
npm run setup     # trusts a local CA + issues a localhost cert + writes .token
```

`npm run setup` runs `mkcert` (install it first: `brew install mkcert`). The
cert is only needed for the **https** path (GitHub Pages → `wss`). For **local
dev** (`http://localhost:5173`) the app uses plain `ws`, so the cert is
optional there — but the `.token` is always required.

## Run / register

Either run it standalone:

```bash
npm start          # a shim; also brings the shared daemon up
npm run relay      # just the daemon, in the foreground (handy for watching logs)
```

…or register it with your Claude so it spawns automatically:

- **Claude Code** — already wired via the committed `../.mcp.json` (repo-relative
  path). Open the repo in Claude Code and approve the `flyer` server once.
- **Claude Desktop** — add to `claude_desktop_config.json` with an **absolute**
  path (per device, not committed):

  ```json
  { "mcpServers": { "flyer": { "command": "node", "args": ["/ABS/PATH/flyer-editor/bridge/server.js"] } } }
  ```

## Connect the editor

Open the editor, click **"Připojit k AI"** in the toolbar, paste the token from
`bridge/.token`, and Připojit. Status shows `🟢 AI připojeno`. If the bridge
isn't running the app works normally and shows `🔴 AI nepřipojeno`.

## Ports

- `wss://localhost:8787` — secure, for https origins (Pages). Needs the cert.
- `ws://localhost:8788` — plain, for http dev origins. No cert.

Both bind to loopback only and enforce an origin allowlist + the shared token.

## Test (no Claude / browser needed)

```bash
node test/harness.mjs           # relay + security gate, via a real MCP client
node test/probe.mjs get_state   # one live tool call (needs the editor tab open)
node test/flow.mjs propose_changes '{"title":"X"}'   # full propose→decide loop
```
