import { useEffect, useRef } from 'react'
import { sqliteTrue } from '@evolu/common'
import {
  useEvolu,
  evolu,
  snapshotsByConceptQuery,
  type ConceptId,
  type ConceptLogoId,
  type ConceptSnapshotId,
} from '../db/schema'
import type { ConceptMeta, Palette } from '../types'

const MAX_IDLE_MS = 45_000
const MAX_INTERVAL_MS = 10 * 60 * 1000

/** Stable key representing the current content — used to skip duplicate auto-snapshots. */
function contentKey(meta: ConceptMeta, markdown: string): string {
  return [
    meta.title, meta.org, meta.year, meta.web,
    meta.fontSize, meta.palette, markdown,
  ].join('\x00')
}

function pluralLines(n: number): string {
  if (n === 1) return '1 řádek'
  if (n >= 2 && n <= 4) return `${n} řádky`
  return `${n} řádků`
}

function describeChange(
  prev: { meta: ConceptMeta; markdown: string } | null,
  next: { meta: ConceptMeta; markdown: string },
): string {
  if (prev === null) return 'vytvořeno'

  const metaChanges: string[] = []
  if (prev.meta.title !== next.meta.title) metaChanges.push('název změněn')
  if (prev.meta.org !== next.meta.org) metaChanges.push('organizace změněna')
  if (prev.meta.year !== next.meta.year) metaChanges.push('rok změněn')
  if (prev.meta.web !== next.meta.web) metaChanges.push('web změněn')
  if (prev.meta.fontSize !== next.meta.fontSize) metaChanges.push('velikost písma změněna')
  if (prev.meta.palette !== next.meta.palette) metaChanges.push('barevnost změněna')
  if (prev.meta.logoId !== next.meta.logoId) metaChanges.push('logo změněno')

  const markdownChanged = prev.markdown !== next.markdown
  let lineStat = ''
  if (markdownChanged) {
    const prevLines = prev.markdown.split('\n')
    const nextLines = next.markdown.split('\n')
    const prevSet = new Set(prevLines)
    const nextSet = new Set(nextLines)
    let added = 0, removed = 0
    for (const l of nextLines) { if (!prevSet.has(l)) added++ }
    for (const l of prevLines) { if (!nextSet.has(l)) removed++ }

    const parts: string[] = []
    if (added > 0) parts.push(`+${pluralLines(added)}`)
    if (removed > 0) parts.push(`−${pluralLines(removed)}`)
    lineStat = parts.join(' / ')
  }

  if (metaChanges.length === 0 && !markdownChanged) return 'beze změny'
  if (metaChanges.length === 0) return lineStat
  if (!markdownChanged) return metaChanges.join(', ')
  return metaChanges.join(', ') + '; ' + lineStat
}

export function useSnapshots(
  activeId: ConceptId | null,
  meta: ConceptMeta,
  markdown: string,
) {
  const { insert, update } = useEvolu()

  // Always-current refs — updated synchronously on every render
  const activeIdRef = useRef(activeId)
  const metaRef = useRef(meta)
  const markdownRef = useRef(markdown)
  activeIdRef.current = activeId
  metaRef.current = meta
  markdownRef.current = markdown

  // Last auto-snapshot content key per concept (deduplication)
  const lastAutoKeyRef = useRef('')

  // Tracks previously-captured content for diff computation
  const lastSnapshotContentRef = useRef<{ meta: ConceptMeta; markdown: string } | null>(null)

  // Debounce timer ref
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Timestamp of last auto-snapshot
  const lastAutoTimeRef = useRef<number>(0)

  // Reset dedup key and seed lastSnapshotContentRef when the active concept changes
  useEffect(() => {
    lastAutoKeyRef.current = ''
    lastAutoTimeRef.current = 0
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (!activeId) {
      lastSnapshotContentRef.current = null
      return
    }
    // Seed from latest snapshot
    evolu.loadQuery(snapshotsByConceptQuery(activeId)).then(rows => {
      const first = rows[0]
      if (!first) {
        lastSnapshotContentRef.current = null
        return
      }
      lastSnapshotContentRef.current = {
        meta: {
          title: String(first.title ?? ''),
          org: String(first.org ?? ''),
          year: String(first.year ?? ''),
          web: String(first.web ?? ''),
          fontSize: Number(first.fontSize ?? 9.5),
          palette: first.palette ? (String(first.palette) as Palette) : 'color',
          logo: first.logoData ? String(first.logoData) : '',
          logoId: first.logoId ? String(first.logoId) : null,
        },
        markdown: String(first.markdown ?? ''),
      }
    })
  }, [activeId])

  // Prune ref — reassigned each render to capture latest update
  const pruneRef = useRef((_conceptId: ConceptId) => {})
  pruneRef.current = (conceptId: ConceptId) => {
    evolu.loadQuery(snapshotsByConceptQuery(conceptId)).then(rows => {
      // Only auto snapshots
      const autoRows = rows.filter(r => r.source === 'auto')
      // Already sorted newest first
      const now = Date.now()
      const oneHourAgo = now - 60 * 60 * 1000
      const oneDayAgo = now - 24 * 60 * 60 * 1000

      const toDelete = new Set<string>()

      const olderThan1h = autoRows.filter(r => new Date(String(r.createdAt)).getTime() < oneHourAgo)
      const olderThan24h = olderThan1h.filter(r => new Date(String(r.createdAt)).getTime() < oneDayAgo)
      const between1hAnd24h = olderThan1h.filter(r => new Date(String(r.createdAt)).getTime() >= oneDayAgo)

      // Hour buckets (1h-24h): keep newest per hour bucket
      const hourBuckets = new Map<number, typeof autoRows[0]>()
      for (const row of between1hAnd24h) {
        const t = new Date(String(row.createdAt)).getTime()
        const bucket = Math.floor(t / (60 * 60 * 1000))
        if (!hourBuckets.has(bucket)) {
          hourBuckets.set(bucket, row) // first = newest (desc order)
        } else {
          toDelete.add(String(row.id))
        }
      }

      // Day buckets (>24h): keep newest per day bucket
      const dayBuckets = new Map<number, typeof autoRows[0]>()
      for (const row of olderThan24h) {
        const t = new Date(String(row.createdAt)).getTime()
        const bucket = Math.floor(t / (24 * 60 * 60 * 1000))
        if (!dayBuckets.has(bucket)) {
          dayBuckets.set(bucket, row)
        } else {
          toDelete.add(String(row.id))
        }
      }

      for (const id of toDelete) {
        update('conceptSnapshot', { id: id as ConceptSnapshotId, isDeleted: sqliteTrue })
      }
    })
  }

  // Stable writer — reassigned on every render
  const writeRef = useRef((_label: string | null, _source: 'auto' | null) => {})
  writeRef.current = (label: string | null, source: 'auto' | null) => {
    const id = activeIdRef.current
    if (!id) return

    const key = contentKey(metaRef.current, markdownRef.current)
    if (source === 'auto' && key === lastAutoKeyRef.current) return

    const summary = describeChange(lastSnapshotContentRef.current, {
      meta: metaRef.current,
      markdown: markdownRef.current,
    })

    insert('conceptSnapshot', {
      conceptId: id,
      label,
      source,
      summary,
      title:    metaRef.current.title,
      org:      metaRef.current.org,
      year:     metaRef.current.year,
      web:      metaRef.current.web,
      fontSize: metaRef.current.fontSize,
      palette:  metaRef.current.palette,
      markdown: markdownRef.current,
      logoId:   metaRef.current.logoId as ConceptLogoId | null,
    })

    // Update lastSnapshotContentRef after write
    lastSnapshotContentRef.current = {
      meta: { ...metaRef.current },
      markdown: markdownRef.current,
    }

    if (source === 'auto') {
      lastAutoKeyRef.current = key
      lastAutoTimeRef.current = Date.now()
      pruneRef.current(id)
    }
  }

  // Debounce-after-idle effect
  useEffect(() => {
    if (!activeId) return

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    // Check max interval cap
    if (lastAutoTimeRef.current > 0 && Date.now() - lastAutoTimeRef.current >= MAX_INTERVAL_MS) {
      writeRef.current(null, 'auto')
      return
    }

    // Schedule debounced auto-snapshot
    debounceTimerRef.current = setTimeout(() => {
      writeRef.current(null, 'auto')
      debounceTimerRef.current = null
    }, MAX_IDLE_MS)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [activeId, meta, markdown])

  return {
    saveAutoSnapshot: () => writeRef.current(null, 'auto'),
    saveManualSnapshot: (label: string | null = null) => writeRef.current(label, null),
  }
}
