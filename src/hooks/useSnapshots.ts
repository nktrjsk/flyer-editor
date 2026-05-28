import { useEffect, useRef } from 'react'
import { useEvolu, type ConceptId } from '../db/schema'
import type { ConceptMeta } from '../types'

const AUTO_INTERVAL_MS = 5 * 60 * 1000

/** Stable key representing the current content — used to skip duplicate auto-snapshots. */
function contentKey(meta: ConceptMeta, markdown: string): string {
  return [
    meta.title, meta.org, meta.year, meta.web,
    meta.fontSize, meta.palette, markdown,
  ].join('\x00')
}

/**
 * Manages automatic and manual concept snapshots.
 *
 * Auto-snapshots are taken:
 *   - Explicitly via saveAutoSnapshot() — call this before switching concepts
 *   - Every AUTO_INTERVAL_MS while a concept is active
 *
 * Consecutive auto-snapshots with identical content are silently skipped.
 * Manual snapshots (saveManualSnapshot) are always written.
 */
export function useSnapshots(
  activeId: ConceptId | null,
  meta: ConceptMeta,
  markdown: string,
) {
  const { insert } = useEvolu()

  // Always-current refs — updated synchronously on every render
  // so event handlers see the latest values without stale closures.
  const activeIdRef = useRef(activeId)
  const metaRef = useRef(meta)
  const markdownRef = useRef(markdown)
  activeIdRef.current = activeId
  metaRef.current = meta
  markdownRef.current = markdown

  // Last auto-snapshot content key per concept (deduplication)
  const lastAutoKeyRef = useRef('')

  // Reset dedup key when the active concept changes
  useEffect(() => {
    lastAutoKeyRef.current = ''
  }, [activeId])

  // Stable writer — reassigned on every render so it always closes
  // over the latest `insert` from Evolu without being a dep of effects.
  const writeRef = useRef((_label: string | null, _source: 'auto' | null) => {})
  writeRef.current = (label: string | null, source: 'auto' | null) => {
    const id = activeIdRef.current
    if (!id) return

    const key = contentKey(metaRef.current, markdownRef.current)
    if (source === 'auto' && key === lastAutoKeyRef.current) return

    insert('conceptSnapshot', {
      conceptId: id,
      label,
      source,
      title:    metaRef.current.title,
      org:      metaRef.current.org,
      year:     metaRef.current.year,
      web:      metaRef.current.web,
      fontSize: metaRef.current.fontSize,
      palette:  metaRef.current.palette,
      markdown: markdownRef.current,
    })

    if (source === 'auto') lastAutoKeyRef.current = key
  }

  // Periodic auto-snapshot
  useEffect(() => {
    if (!activeId) return
    const timer = setInterval(() => writeRef.current(null, 'auto'), AUTO_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [activeId])

  return {
    /**
     * Snapshot current content as an auto-snapshot.
     * Call this *before* switching / deleting a concept so the refs
     * still point at the outgoing concept's content.
     */
    saveAutoSnapshot: () => writeRef.current(null, 'auto'),

    /**
     * Snapshot with an optional user label.
     * Always written regardless of deduplication (source = null = manual).
     */
    saveManualSnapshot: (label: string | null = null) => writeRef.current(label, null),
  }
}
