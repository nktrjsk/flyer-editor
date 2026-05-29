import { useEffect, useRef } from 'react'
import { useEvolu, type ConceptId } from '../db/schema'
import type { ConceptMeta } from '../types'

/**
 * Debounced auto-save: writes meta + markdown to Evolu 500ms after last change.
 *
 * `isSynced` must be true before any save is scheduled — it signals that local
 * state (meta, markdown) belongs to activeId and not a previous concept.
 * Using a render-time boolean (rather than a ref mutated inside the effect)
 * makes this resilient to React Strict Mode's double-invocation of effects.
 */
export function useAutoSave(
  activeId: ConceptId | null,
  meta: ConceptMeta,
  markdown: string,
  isSynced: boolean,
) {
  const { update } = useEvolu()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!activeId || !isSynced) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      update('concept', {
        id:       activeId,
        title:    meta.title,
        org:      meta.org,
        year:     meta.year,
        web:      meta.web,
        fontSize: meta.fontSize,
        logo:     meta.logo || null,
        palette:  meta.palette,
        markdown,
      })
    }, 500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [activeId, meta, markdown, update, isSynced])
}
