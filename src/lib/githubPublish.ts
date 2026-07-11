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
  sha?: string,
): Promise<GhFileContent> {
  const put = (withSha?: string) =>
    ghFetch(cfg, `/repos/${cfg.owner}/${cfg.repo}/contents/${encodePath(path)}`, {
      method: 'PUT',
      body: JSON.stringify({ message, content: contentB64, branch: cfg.branch, ...(withSha ? { sha: withSha } : {}) }),
    })

  let res = await put(sha)
  // 422 = path already exists and we didn't pass its sha (can happen when a
  // folder move overwrites a leftover from a prior partial move). Fetch the
  // current sha and retry as an update rather than a create.
  if (res.status === 422 && !sha) {
    const existing = await getContent(cfg, path)
    const esha = !Array.isArray(existing) ? existing?.sha : undefined
    if (esha) res = await put(esha)
  }
  if (!res.ok) throw new Error(await ghError(res))
  const json = await res.json()
  return json.content ?? json
}

async function deleteContent(cfg: PublishConfig, path: string, sha: string, message: string): Promise<void> {
  const res = await ghFetch(cfg, `/repos/${cfg.owner}/${cfg.repo}/contents/${encodePath(path)}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha, branch: cfg.branch }),
  })
  // Tolerate "already gone" — a move's delete pass is best-effort cleanup.
  if (!res.ok && res.status !== 404 && res.status !== 422) throw new Error(await ghError(res))
}

/** Quick auth/repo check used by the "test connection" button. */
export async function checkAccess(cfg: PublishConfig): Promise<void> {
  const res = await ghFetch(cfg, `/repos/${cfg.owner}/${cfg.repo}`)
  if (!res.ok) throw new Error(await ghError(res))
}

// ── Locating a flyer in the repo ─────────────────────────────────────────────
// Identity is the frontmatter `publishId`, NOT the folder name (folders are now
// readable slugs). To publish the next version we must find where the flyer
// currently lives: try the caller's slug hint, then the legacy hex folder, then
// scan. Cheap for a small archive; fully repo-derived so a DB wipe can't lie.
const RE_VERSION = /^v(\d+)\.md$/

/** Read a folder's identity: its highest version and the publishId in that
 *  version's frontmatter. Returns null if the folder isn't a flyer folder. */
async function folderIdentity(
  cfg: PublishConfig,
  path: string,
): Promise<{ publishId: string | null; version: number } | null> {
  const files = await getContent(cfg, path)
  if (!Array.isArray(files)) return null
  let version = 0
  let latest: GhContentItem | null = null
  for (const f of files) {
    const m = RE_VERSION.exec(f.name)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > version) { version = n; latest = f }
    }
  }
  if (!latest) return null
  const data = await getContent(cfg, latest.path)
  if (Array.isArray(data) || !data?.content) return { publishId: null, version }
  const parsed = parseFlyer(base64ToUtf8(data.content))
  return { publishId: parsed?.fm.publishId ?? null, version }
}

interface FlyerLocation { path: string; slug: string; version: number }

/** Find the folder currently holding this publishId. Prefers the hint slug and
 *  the legacy hex folder (name === publishId) before a full scan. If a partial
 *  move left the flyer in two folders, the highest version wins. */
async function locateFlyer(
  cfg: PublishConfig,
  publishId: string,
  hint?: string | null,
): Promise<FlyerLocation | null> {
  const tryFolder = async (slug: string): Promise<FlyerLocation | null> => {
    const id = await folderIdentity(cfg, `flyers/${slug}`)
    // A legacy hex folder (name === publishId) may predate publishId frontmatter.
    if (id && (id.publishId === publishId || slug === publishId)) {
      return { path: `flyers/${slug}`, slug, version: id.version }
    }
    return null
  }

  const tried = new Set<string>()
  if (hint) { tried.add(hint); const r = await tryFolder(hint); if (r) return r }
  if (!tried.has(publishId)) { tried.add(publishId); const r = await tryFolder(publishId); if (r) return r }

  const dirs = await getContent(cfg, 'flyers')
  if (!Array.isArray(dirs)) return null
  let found: FlyerLocation | null = null
  for (const d of dirs) {
    if (d.type !== 'dir' || tried.has(d.name)) continue
    const id = await folderIdentity(cfg, d.path)
    if (id?.publishId === publishId && (!found || id.version > found.version)) {
      found = { path: d.path, slug: d.name, version: id.version }
    }
  }
  return found
}

/** Resolve the folder slug to publish into, avoiding collisions with a
 *  DIFFERENT flyer. If `desiredSlug` is free or already ours, use it; if a
 *  different flyer owns it, append a short id suffix. */
async function resolveTargetSlug(cfg: PublishConfig, desiredSlug: string, publishId: string): Promise<string> {
  const id = await folderIdentity(cfg, `flyers/${desiredSlug}`)
  if (!id || id.publishId === publishId) return desiredSlug
  return `${desiredSlug}-${publishId.slice(0, 4)}`
}

/** Copy every file from one folder to another, then delete the originals.
 *  Copy-all-first / delete-last: a mid-failure leaves harmless duplicates, and
 *  `locateFlyer` prefers the highest version, so the next publish self-heals. */
async function moveFolder(cfg: PublishConfig, fromPath: string, toPath: string): Promise<void> {
  const files = await getContent(cfg, fromPath)
  if (!Array.isArray(files)) return
  const moved: GhContentItem[] = []
  for (const f of files) {
    if (f.type !== 'file') continue
    const data = await getContent(cfg, f.path)
    if (Array.isArray(data) || !data?.content) continue
    await putContent(cfg, `${toPath}/${f.name}`, data.content.replace(/\s/g, ''), `Move ${f.name} → ${toPath}`)
    moved.push(f)
  }
  for (const f of moved) {
    await deleteContent(cfg, f.path, f.sha, `Remove ${f.path} after folder rename`)
  }
}

// ── Publish ──────────────────────────────────────────────────────────────────
export interface PublishInput {
  publishId: string
  /** desired readable slug for the folder, derived from the current title */
  slug: string
  /** last-published folder name (Evolu hint); speeds up locate, may be stale */
  knownSlug?: string | null
  meta: ConceptMeta
  markdown: string
}

export interface PublishResult {
  version: number
  url: string
  /** the folder slug actually used (may differ from input on collision) */
  slug: string
}

export async function publishConcept(cfg: PublishConfig, input: PublishInput): Promise<PublishResult> {
  const { publishId, meta, markdown } = input

  // Where does this flyer currently live, and what's the next version?
  const current = await locateFlyer(cfg, publishId, input.knownSlug)
  const version = (current?.version ?? 0) + 1

  // Collision-aware target folder for the (possibly retitled) slug.
  const targetSlug = await resolveTargetSlug(cfg, input.slug, publishId)
  const dir = `flyers/${targetSlug}`

  // Retitle or legacy-hex migration: fold the whole history into the new folder
  // before writing the new version, so all versions stay together.
  if (current && current.path !== dir) {
    await moveFolder(cfg, current.path, dir)
  }

  // Logo first (so the .md can reference a file that already exists).
  let logoFile: string | null = null
  if (meta.logo) {
    const parsed = parseDataUrl(meta.logo)
    if (parsed) {
      const ext = MIME_EXT[parsed.mime] ?? 'png'
      logoFile = `v${version}-logo.${ext}`
      await putContent(cfg, `${dir}/${logoFile}`, parsed.b64.replace(/\s/g, ''), `Flyer ${targetSlug} v${version} (logo)`)
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

  const res = await putContent(cfg, `${dir}/v${version}.md`, utf8ToBase64(fileText), `Publish ${targetSlug} v${version}`)
  const url = res.html_url ?? `https://github.com/${cfg.owner}/${cfg.repo}/blob/${cfg.branch}/${dir}/v${version}.md`
  return { version, url, slug: targetSlug }
}

// ── Import (recovery) ──────────────────────────────────────────────────────────
export interface ImportedFlyer {
  publishId: string
  /** the folder slug it was read from → repopulates lastPublishedSlug on import */
  slug: string
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
  /** ISO timestamp from frontmatter, or null → repopulates lastPublishedAt */
  publishedAt: string | null
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
      slug: d.name,
      version: best,
      markdown,
      logoDataUrl,
      publishedAt: fm.publishedAt ?? null,
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
