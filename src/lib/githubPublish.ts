// GitHub publishing: write finished flyers to a git repo as versioned Markdown,
// and import them back for recovery. The repo is a durable archive of *finished*
// flyers — Evolu remains the source of truth + sync layer.
//
// Layout (decided): flyers/<publishId>/vN.md  + per-version logo sidecar.
// Version is derived from the repo each publish (list folder, max+1), never
// tracked in Evolu — a wipe would reset an Evolu-tracked counter and clobber v1.

import type { ConceptMeta, Palette } from '../types'
import { serializeFlyer, parseFlyer } from './flyerFile'

// ── Config (per-device, localStorage; never synced via Evolu, never committed) ──
const LS_KEY = 'flyer-editor:publishConfig'

export interface PublishConfig {
  owner: string
  repo: string
  branch: string
  /** fine-grained, single-repo PAT with Contents: read & write */
  token: string
}

export function loadPublishConfig(): PublishConfig | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    return {
      owner: c.owner ?? '',
      repo: c.repo ?? '',
      branch: c.branch || 'main',
      token: c.token ?? '',
    }
  } catch {
    return null
  }
}

export function savePublishConfig(cfg: PublishConfig): void {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg))
}

export function isConfigured(cfg: PublishConfig | null): cfg is PublishConfig {
  return !!cfg && !!cfg.token && !!cfg.owner && !!cfg.repo
}

/** Generate a stable 12-hex-char publish id. */
export function newPublishId(): string {
  const b = new Uint8Array(6)
  crypto.getRandomValues(b)
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
}

// ── base64 <-> utf8 (GitHub contents API speaks base64) ──────────────────────
function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

function base64ToUtf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

// ── image data-url helpers ───────────────────────────────────────────────────
const MIME_EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
  'image/svg+xml': 'svg', 'image/webp': 'webp',
}
const EXT_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  svg: 'image/svg+xml', webp: 'image/webp',
}

function parseDataUrl(url: string): { mime: string; b64: string } | null {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(url)
  return m ? { mime: m[1], b64: m[2] } : null
}

// ── REST plumbing ────────────────────────────────────────────────────────────
type GhContentItem = { name: string; path: string; type: string; sha: string }
type GhFileContent = { content?: string; encoding?: string; html_url?: string; sha?: string }

function ghFetch(cfg: PublishConfig, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
}

function encodePath(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/')
}

async function ghError(res: Response): Promise<string> {
  try {
    const j = await res.json()
    return `${res.status} ${j.message ?? res.statusText}`
  } catch {
    return `${res.status} ${res.statusText}`
  }
}

/** GET a path's contents. Returns an array (dir), object (file), or null (404). */
async function getContent(
  cfg: PublishConfig,
  path: string,
): Promise<GhContentItem[] | GhFileContent | null> {
  const res = await ghFetch(
    cfg,
    `/repos/${cfg.owner}/${cfg.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(cfg.branch)}`,
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(await ghError(res))
  return res.json()
}

async function putContent(
  cfg: PublishConfig,
  path: string,
  contentB64: string,
  message: string,
): Promise<GhFileContent> {
  const res = await ghFetch(cfg, `/repos/${cfg.owner}/${cfg.repo}/contents/${encodePath(path)}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: contentB64, branch: cfg.branch }),
  })
  if (!res.ok) throw new Error(await ghError(res))
  const json = await res.json()
  return json.content ?? json
}

/** Quick auth/repo check used by the "test connection" button. */
export async function checkAccess(cfg: PublishConfig): Promise<void> {
  const res = await ghFetch(cfg, `/repos/${cfg.owner}/${cfg.repo}`)
  if (!res.ok) throw new Error(await ghError(res))
}

// ── Publish ──────────────────────────────────────────────────────────────────
const RE_VERSION = /^v(\d+)\.md$/

async function nextVersion(cfg: PublishConfig, publishId: string): Promise<number> {
  const list = await getContent(cfg, `flyers/${publishId}`)
  if (!Array.isArray(list)) return 1
  let max = 0
  for (const item of list) {
    const m = RE_VERSION.exec(item.name)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max + 1
}

export interface PublishInput {
  publishId: string
  meta: ConceptMeta
  markdown: string
}

export interface PublishResult {
  version: number
  url: string
}

export async function publishConcept(cfg: PublishConfig, input: PublishInput): Promise<PublishResult> {
  const { publishId, meta, markdown } = input
  const version = await nextVersion(cfg, publishId)
  const dir = `flyers/${publishId}`

  // Logo first (so the .md can reference a file that already exists).
  let logoFile: string | null = null
  if (meta.logo) {
    const parsed = parseDataUrl(meta.logo)
    if (parsed) {
      const ext = MIME_EXT[parsed.mime] ?? 'png'
      logoFile = `v${version}-logo.${ext}`
      await putContent(cfg, `${dir}/${logoFile}`, parsed.b64.replace(/\s/g, ''), `Flyer ${publishId} v${version} (logo)`)
    }
  }

  const fileText = serializeFlyer(
    {
      publishId,
      version,
      title: meta.title,
      org: meta.org,
      year: meta.year,
      web: meta.web,
      fontSize: meta.fontSize,
      palette: meta.palette,
      logo: logoFile,
      publishedAt: new Date().toISOString(),
    },
    markdown,
  )

  const res = await putContent(cfg, `${dir}/v${version}.md`, utf8ToBase64(fileText), `Publish flyer ${publishId} v${version}`)
  const url = res.html_url ?? `https://github.com/${cfg.owner}/${cfg.repo}/blob/${cfg.branch}/${dir}/v${version}.md`
  return { version, url }
}

// ── Import (recovery) ──────────────────────────────────────────────────────────
export interface ImportedFlyer {
  publishId: string
  version: number
  meta: {
    title: string
    org: string
    year: string
    web: string
    fontSize: number
    palette: Palette
  }
  markdown: string
  /** reconstructed data: URL for the logo, or null */
  logoDataUrl: string | null
}

/** Read the latest version of every published flyer. Does NOT touch Evolu —
 *  the caller decides what to (re)create. */
export async function importFromRepo(cfg: PublishConfig): Promise<ImportedFlyer[]> {
  const dirs = await getContent(cfg, 'flyers')
  if (!Array.isArray(dirs)) return []

  const out: ImportedFlyer[] = []
  for (const d of dirs) {
    if (d.type !== 'dir') continue

    const files = await getContent(cfg, d.path)
    if (!Array.isArray(files)) continue

    // Latest version wins.
    let best = 0
    let bestFile: GhContentItem | null = null
    for (const f of files) {
      const m = RE_VERSION.exec(f.name)
      if (m) {
        const n = parseInt(m[1], 10)
        if (n > best) { best = n; bestFile = f }
      }
    }
    if (!bestFile) continue

    const fileData = await getContent(cfg, bestFile.path)
    if (Array.isArray(fileData) || !fileData?.content) continue
    const parsed = parseFlyer(base64ToUtf8(fileData.content))
    if (!parsed) continue
    const { fm, markdown } = parsed

    let logoDataUrl: string | null = null
    if (fm.logo) {
      const logoData = await getContent(cfg, `${d.path}/${fm.logo}`)
      if (!Array.isArray(logoData) && logoData?.content) {
        const ext = fm.logo.split('.').pop()?.toLowerCase() ?? 'png'
        const mime = EXT_MIME[ext] ?? 'image/png'
        logoDataUrl = `data:${mime};base64,${logoData.content.replace(/\s/g, '')}`
      }
    }

    out.push({
      publishId: fm.publishId ?? d.name,
      version: best,
      markdown,
      logoDataUrl,
      meta: {
        title: fm.title ?? '',
        org: fm.org ?? '',
        year: fm.year ?? '',
        web: fm.web ?? '',
        fontSize: fm.fontSize ?? 9.5,
        palette: fm.palette ?? 'color',
      },
    })
  }
  return out
}
