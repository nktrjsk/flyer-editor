// Serialize / parse a published flyer file: YAML-ish frontmatter + Markdown body.
//
// The format is one we both write and read, so the parser stays deliberately
// small — it understands flat `key: value` lines with optionally double-quoted
// string values. It is NOT a general YAML parser.

import type { Palette } from '../types'

export interface FlyerFrontmatter {
  publishId: string
  version: number
  title: string
  org: string
  year: string
  web: string
  fontSize: number
  palette: Palette
  /** sidecar image filename relative to the flyer folder, or null */
  logo: string | null
  /** ISO timestamp */
  publishedAt: string
}

function quote(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

function unquote(v: string): string {
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  return v
}

/** Build the file content: `---` frontmatter `---` then the Markdown body. */
export function serializeFlyer(fm: FlyerFrontmatter, markdown: string): string {
  const lines = [
    '---',
    `publishId: ${fm.publishId}`,
    `version: ${fm.version}`,
    `title: ${quote(fm.title)}`,
    `org: ${quote(fm.org)}`,
    `year: ${quote(fm.year)}`,
    `web: ${quote(fm.web)}`,
    `fontSize: ${fm.fontSize}`,
    `palette: ${fm.palette}`,
    `logo: ${fm.logo ?? 'null'}`,
    `publishedAt: ${quote(fm.publishedAt)}`,
    '---',
    '',
  ]
  const body = markdown.endsWith('\n') ? markdown : markdown + '\n'
  return lines.join('\n') + body
}

export interface ParsedFlyer {
  fm: Partial<FlyerFrontmatter> & { raw: Record<string, string> }
  markdown: string
}

/** Parse a flyer file back into frontmatter fields + body. Returns null if it
 *  has no frontmatter block. */
export function parseFlyer(text: string): ParsedFlyer | null {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
  if (!m) return null
  const [, block, body] = m

  const raw: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const i = line.indexOf(':')
    if (i === -1) continue
    raw[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }

  const fontSize = Number(raw.fontSize)
  const fm: ParsedFlyer['fm'] = {
    raw,
    publishId: raw.publishId,
    version: Number.isFinite(Number(raw.version)) ? Number(raw.version) : undefined,
    title: raw.title != null ? unquote(raw.title) : undefined,
    org: raw.org != null ? unquote(raw.org) : undefined,
    year: raw.year != null ? unquote(raw.year) : undefined,
    web: raw.web != null ? unquote(raw.web) : undefined,
    fontSize: Number.isFinite(fontSize) ? fontSize : undefined,
    palette: raw.palette === 'bw' ? 'bw' : 'color',
    logo: raw.logo && raw.logo !== 'null' ? raw.logo : null,
    publishedAt: raw.publishedAt != null ? unquote(raw.publishedAt) : undefined,
  }

  // Body: strip the single trailing newline serialize added, keep the rest.
  return { fm, markdown: body.replace(/\n$/, '') }
}
