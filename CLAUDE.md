# flyer-editor

Browser-based A5 flyer editor. Markdown in → print-ready HTML/PDF out.  
Pure vanilla HTML/CSS/JS — no build step, no framework.

## Dev

```bash
npm install          # installs live-server (one-time)
npm run dev          # opens http://localhost:8080 with live-reload (browser-sync)
```

Or without Node: `python3 -m http.server 8080`

## Architecture

| File | Role |
|------|------|
| `index.html` | Shell, metadata form, textarea |
| `style.css` | Editor UI + A5 page layout (print-safe) |
| `editor.js` | Render loop, title auto-scale, download |

**Critical:** `editor.js:143` checks `script[src="editor.js"]` to detect dev vs standalone mode.  
`editor.js:150-151` fetches `style.css` and `editor.js` by relative URL to inline them on download.  
→ Do **not** rename or bundle these files; do **not** use a bundler in dev mode.

## Output formats

- **Download HTML** — inlines CSS+JS into a self-contained portable file
- **Print / PDF** — browser print dialog; choose A5, no margins

## Deployment

Deployed via GitHub Actions → GitHub Pages (see `.github/workflows/deploy.yml`).  
Push to `main` → auto-deploys. Custom domain: add a `CNAME` file with your domain and configure DNS.
