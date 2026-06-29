# flyer-editor

Browser-based A5 flyer editor. Markdown in → print-ready HTML/PDF out.
Local-first: edits live in the browser (Evolu/SQLite) and sync across devices via a mnemonic.

**Stack:** React 19 + TypeScript + Vite 6. Evolu for storage + sync. `marked` for
Markdown → HTML, `html2canvas` for preview screenshots. No server of its own — static
hosting on GitHub Pages.

## Dev

```bash
npm install
npm run dev          # vite dev server (http://localhost:5173)
npm run build        # tsc -b && vite build → dist/
npm run preview      # serve the production build locally
```

## Architecture

Source lives in `src/`. Entry: `index.html` → `src/main.tsx` → `src/components/App.tsx`.

| Area | Role |
|------|------|
| `src/components/EditorLayout.tsx` | Holds the live concept state (meta + markdown); the single-writer path. `handleRestore` is the canonical "replace current content" gate — AI proposals and snapshot restores both flow through it. |
| `src/components/PreviewPane.tsx` + `Page.tsx` | A5 render; computes overflow + title auto-fit (the "vision facts"). `.page` is the screenshot target. |
| `src/components/MarkdownEditor.tsx`, `MetaSection.tsx`, `SourcePane.tsx` | Markdown textarea + metadata form. |
| `src/components/Sidebar.tsx`, `HistoryExplorer.tsx`, `HistoryPanel.tsx`, `DiffView.tsx` | Concept list + snapshot history/restore + line diffs. |
| `src/components/SettingsModal.tsx` | Sync mnemonic display/restore. |
| `src/components/ToastProvider.tsx`, `ConfirmProvider.tsx` | Toast + confirm primitives. |
| `src/db/schema.ts` | Evolu schema (`concept`, `conceptSnapshot`, `conceptLogo`), the Evolu instance, and queries. |
| `src/hooks/` | `useConcepts`, `useActiveConcept`, `useSnapshots`, `useAutoSave`, `useAiBridge`. |
| `src/lib/` | `diff`, `recovery`, `editorCache`, `aiBridge`, `flyerScreenshot`. |

**Data model (`src/db/schema.ts`):** a `concept` row is the source of truth
(title/org/year/web/fontSize/palette/markdown + logo). Logos live in a shared
`conceptLogo` table referenced by `logoId` so many snapshots reuse one base64 payload
(legacy inline `concept.logo` kept for back-compat). Snapshots are working history in
Evolu — see the snapshot-overhaul design.

**Cross-origin isolation:** Evolu's SQLite-wasm needs `SharedArrayBuffer`, which requires
COOP/COEP headers. GitHub Pages can't set headers, so `coi-serviceworker` injects them
client-side. Vite `base` is `/flyer-editor/`; Evolu `reloadUrl` uses `import.meta.env.BASE_URL`
so resets land on the right path in both dev and prod.

## AI bridge (`bridge/`)

A separate local Node process (its own `package.json`, plain JS) that lets external Claude
(Desktop/Code) read, screenshot, and **propose** edits to the live editor tab — all
human-gated through `ProposalReview`. It is **local-only**, never deployed: excluded from the
Pages build (own package.json so root `npm ci` skips it; plain JS so `tsc -b` ignores it; Vite
bundles only `src/`). Full spec: `docs/ai-bridge.md`; per-device setup: `bridge/README.md`.

## Output formats

- **Download HTML** — self-contained portable file
- **Print / PDF** — browser print dialog; choose A5, no margins

## Deployment

GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml`): `npm ci && npm run build`,
publishes `dist/`. Push to `main` → auto-deploys.
