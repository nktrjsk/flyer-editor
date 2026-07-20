# AI bridge (MCP integration) — design & setup

> **Status:** designed, not yet built. This doc is the canonical spec.
> The goal: let *your own Claude* (Desktop or Code) read, see, and **propose**
> changes to the live flyer in the editor tab — no more manual copy-paste —
> while every change stays gated behind your explicit approval.

## The one thing to understand first

The MCP server **is not deployed.** It runs **locally, on your machine, per
device.** The published app (`https://…github.io/flyer-editor/`) is just static
files on GitHub's CDN. The MCP server is a Node process you run on the *same*
machine; the editor tab dials *out* to it over `wss://localhost`.

So there are two independent concerns:
- **Where the source lives** → in this repo, under `bridge/` (travels via clone).
- **How each machine runs + registers it** → one-time per-device setup (below).

Nothing about the bridge ever reaches GitHub Pages — see *Deploy isolation*.

## Architecture

The bridge is **two processes**, split so multiple Claude clients can never
contend for the relay ports (the original single-process design made a second
client `EADDRINUSE`-exit, killing its own MCP tools):

```
┌──────────────────────┐  stdio   ┌─────────────────────┐
│ Claude Desktop / Code │ ───────► │ bridge/server.js    │ ── one SHIM per client
│ (your cockpit)        │  MCP     │ (MCP face, no ports) │     (binds nothing)
└──────────────────────┘          └─────────┬───────────┘
                                   unix sock │ {t:'call'|'reply'}
                                             ▼
┌─────────────────────────┐  wss/ws  ┌─────────────────────┐
│ editor tab (Pages or dev)│ ◄──────► │ bridge/relay.js     │ ── singleton DAEMON
│  window bridge client    │ {id,tool}│ • owns 8787/8788     │   (auto-spawned,
└─────────────────────────┘ {id,res} │ • owns the 1 tab     │    shared, self-exits
                                      │ • origin + token gate│    when idle)
                                      └─────────────────────┘
```

N clients → N shims → 1 daemon → 1 tab. The shim ensures the daemon is running
(spawning it detached if needed) and forwards calls; the daemon self-exits ~30 s
after the last shim disconnects, so a stale daemon from older code can't linger.

The bridge is still a **dumb relay**: it forwards each MCP tool call to the
active tab and returns the tab's reply. All the real logic (diffing, gating,
snapshots) lives in the app, where it already exists.

### Transport: `wss` for https, `ws` for http dev
An `https` page (GitHub Pages) cannot open `ws://localhost` (mixed content,
blocked) — it must use `wss://localhost:8787`, which needs the local cert
trusted (hence `mkcert`). A local **dev** page is `http://localhost:5173`, which
can open plain `ws://localhost:8788` with **no cert at all**.

So the bridge listens on **both** ports and the app picks by `location.protocol`.
Net effect: local development needs no `mkcert`; only the deployed https path
does. Both listeners bind to loopback only and enforce the same origin
allowlist + shared token.

### Security (not optional)
`wss://localhost:PORT` is reachable by **any** web page you have open, not just
this app. The bridge therefore enforces, on every connection:
- **Origin allowlist** — only `http://localhost:5173` (dev) and your
  `*.github.io` origin.
- **Shared token** — the app presents a token on connect; the bridge rejects
  mismatches. Generated locally, gitignored (`bridge/.token`).

## Tool surface

| Tool | Effect |
|------|--------|
| `get_state(id?)` | Returns `{ meta, markdown, pages, overflow, overflowingPages, titleFitPt, palette, hasLogo }`. Without `id`, reads the **unsaved** in-editor state of the active flyer — exactly what you see. With `id` (from `list_concepts`), reads the **saved** state of a *different* flyer instead: it renders that concept's markdown into a hidden, off-screen preview and runs the same fit/overflow measurement the live pane uses, then tears it down — the active flyer and its focus are never touched. Logo presence isn't measured for the off-screen case (`hasLogo` reflects only whether a logo is set on the row). |
| `get_screenshot()` | Best-effort PNG of `.page` via html2canvas (after `document.fonts.ready`). Approximate — see *Vision caveat*. |
| `propose_changes({ markdown?, title?, palette?, fontSize? })` | Stages an **edit proposal**. Returns `"staged"` (or `"auto-accepted"` if trust mode is on — see below). org/web/year can't be proposed — they're auto-derived (identity in Nastavení + last-edit date). |
| `create_concept({ markdown?, title?, palette?, fontSize? })` | Stages a **create proposal** for a brand-new flyer. Returns `"staged"` by default — on Accept the new flyer is created (or `"auto-accepted"` with trust mode on, created immediately). Either way it's created **silently in the background**: it never switches the active flyer, so `get_state` keeps returning the flyer you had open. |
| `switch_concept(id)` | Stages a **switch proposal** ("Claude chce otevřít …"). Returns `"staged"`. |
| `await_decision()` | **Blocks** until you Accept/Reject in the review pane, then returns `{ accepted, reason? }`. Caps at ~45 s → `{ status: "pending" }` (call again). The cap sits under the MCP client's ~60 s per-request timeout. This is how Claude is "notified" you finished reviewing. |
| `list_concepts()` | `[{ id, title }]`. |

`create_concept` is a **gated proposal** like every other AI action — staged,
diffed, and applied only on your Accept (Undo drops the new concept). Unlike
`edit` and `switch`, applying a create never touches or switches the active
concept — the new flyer is just added to the list, so there's nothing to
snapshot on the active side and no focus steal. `delete` isn't exposed to the
AI bridge at all — it stays intentionally **human-only**, sidebar-only (hard to
undo); it could become a gated proposal later.

## Apply model — always human-gated

Every Claude action is a **proposal**, never a write. One typed pending slot:

```
pendingProposal: { kind: 'edit', target: {meta, markdown} }
               | { kind: 'switch', toId }
               | { kind: 'create', target: {meta, markdown} }
               | null      // newer proposal replaces an un-decided one
```

A `<ProposalReview>` pane appears when a proposal exists:
- **edit** → live→target line-diff (reuses the diff component from
  `HistoryExplorer`); recomputed every render so it stays honest if you keep
  typing underneath.
- **switch** → a small confirm card.
- **create** → the new flyer's settings summary + its body previewed as additions.
- `[Přijmout]` / `[Zamítnout]` + optional "proč?" field on reject.

**Accept** = `saveManualSnapshot('Před úpravou od AI')` → the existing
`setMeta`/`setMarkdown` (edit) or `selectConcept` (switch) — *the same single
writer path your own edits use* (mirrors `handleRestore` in
`EditorLayout.tsx`). **create** is the one exception: nothing on the active
concept changes, so there's nothing to snapshot — it just inserts the new row
via `createConcept(…, { select: false })`, leaving the active concept and its
focus alone. Every kind then resolves `await_decision` with `{accepted:true}`
and shows the standard toast-with-Undo. **Reject** discards and resolves
`{accepted:false, reason}`.

Net effect: the AI path is indistinguishable from a restore — one writer, full
snapshot/undo, zero corruption risk.

### Trust mode — opt-in auto-accept for edits and creates

A checkbox in the **AiConnect** popover ("⚡ Automaticky přijímat úpravy a nové
letáky") lets you drop the manual gate **for `edit` and `create` proposals**,
to cut clicking when iterating fast with Claude. It is:

- **Off by default** and **in-memory only** — never persisted, so it can't
  survive a reload.
- **Scoped to `edit` and `create`** — `switch` and `delete` proposals still
  require a manual Accept (higher blast radius). An auto-accepted create is
  applied **silently, without changing the active concept** — no focus steal,
  same as a manually-accepted one (see the table above).
- **Conspicuous while on** — the toolbar button turns amber and reads
  `🟢 AI připojeno · ⚡ auto`.
- **Auto-revoked on disconnect** — dropping the bridge resets it to off, so the
  gate is never left down without a live session.
- **Still snapshot/undo-backed** — each auto-applied edit goes through the same
  single-writer path (`saveManualSnapshot('Před úpravou od AI (auto)')` →
  `setMeta`/`setMarkdown`); each auto-applied create adds the new row and shows
  an Undo that drops it (there's no active-side snapshot to restore — the
  active concept was never touched).

With trust mode on, `propose_changes`/`create_concept` return `"auto-accepted"`
instead of `"staged"` and apply immediately; `await_decision` is unnecessary
(it resolves a call that's already blocked, but nothing is buffered for a
later one).

### Vision caveat
`get_state` always carries the **hard facts as data** (overflow, page count,
title-fit pt, palette, logo presence). The PNG from html2canvas is a
"nice-to-have" on top and is **approximate** — web fonts, CSS filters, and the
logo data-URL can render slightly off. Never treat the image as pixel-truth.

## Repo layout & deploy isolation

```
flyer-editor/
├─ src/            ← React app (ships to Pages)
├─ index.html
├─ package.json    ← app deps only
├─ dist/           ← the ONLY thing deployed
├─ .mcp.json       ← Claude Code registration (committed, repo-relative path)
└─ bridge/         ← MCP server — local-only, NEVER deployed
   ├─ package.json ← own deps: @modelcontextprotocol/sdk, ws
   ├─ server.js    ← plain JS (so `tsc -b` in deploy ignores it)
   ├─ README.md    ← per-device setup
   ├─ cert/        ← mkcert files   (gitignored)
   └─ .token       ← shared secret  (gitignored)
```

The deploy (`.github/workflows/deploy.yml`) runs `npm ci` → `npm run build`
(`tsc -b && vite build`) → uploads **only `./dist`**. The bridge is excluded for
**four independent reasons**:
1. Vite bundles only `src/` + `index.html` into `dist/` — a sibling `bridge/`
   folder cannot enter the build.
2. `bridge/` has its **own `package.json`**, so root `npm ci` never installs its
   deps and they never reach the app bundle.
3. `server.js` is **plain JS**, so `tsc -b` doesn't try to compile it.
4. **No secrets in source** — cert + token are generated locally and gitignored.
   The repo is public; the committed bridge code is just relay logic. Safe.

## Per-device setup

One-time on each machine where you want the Claude↔editor loop:

```bash
cd bridge
npm install

# trust a local cert authority + issue a localhost cert
mkcert -install
mkcert -cert-file cert/localhost.pem -key-file cert/localhost-key.pem localhost

# generate the shared token (any random string), written to bridge/.token
node -e "require('fs').writeFileSync('.token', require('crypto').randomBytes(24).toString('hex'))"
```

Then register the server with **whichever Claude is your cockpit** — both are
supported:

### Option A — Claude Code (project-scoped, travels with the repo)

Committed at the repo root as `.mcp.json`, using a **repo-relative** path so it
works on any device after clone:

```json
{
  "mcpServers": {
    "flyer": {
      "command": "node",
      "args": ["bridge/server.js"]
    }
  }
}
```

Open the project in Claude Code → it discovers `flyer` and asks you to approve
the server (project-scoped MCP servers require approval). Approve once.
No machine-specific paths — clone-and-go.

### Option B — Claude Desktop (global, machine-local)

Edit Claude Desktop's config (macOS:
`~/Library/Application Support/Claude/claude_desktop_config.json`) and add an
**absolute** path (differs per device, so this is *not* committed):

```json
{
  "mcpServers": {
    "flyer": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/flyer-editor/bridge/server.js"]
    }
  }
}
```

Restart Claude Desktop.

> You can *register* the bridge in both clients, but only **one bridge process
> can run at a time** — it owns fixed ports (`8787`/`8788`). Whichever client you
> use spawns a bridge subprocess; if another bridge is already holding the ports,
> the new one logs "another flyer-bridge already owns the ports" and exits
> cleanly (it does **not** start a second relay). So use **one cockpit at a
> time**: quit/disconnect the other client (or stop its bridge) before switching.

### In the app
Open the editor, click **"Připojit k AI"** to claim this tab as the live target.
Status shows `AI připojeno` / `AI nepřipojeno`. If the bridge isn't running the
app behaves normally and shows `AI nepřipojeno` (silent degrade, reconnect with
backoff).

## Build sequence (each step independently testable)

1. **Bridge skeleton + cert** — `wss` up, throwaway tab, echo a ping. Proves the
   mixed-content/cert/token path *before* any app changes (riskiest unknown).
2. **`get_state` + `list_concepts`** — Claude can *read* the live flyer.
   Read-only, zero risk.
3. **`get_screenshot`** — Claude can *see* it.
4. **Proposal state + `<ProposalReview>` + `propose_changes` + `await_decision`**
   — the gated write loop. The core piece.
5. **`switch_concept`** as a proposal — reuses step 4's machinery.
6. **Connect toggle + polish** — status UI, reconnect, reject-reason field.

Steps 1–3 give a working read-and-see assistant with **no write risk** — a
natural place to stop and judge whether the loop is worth finishing.
