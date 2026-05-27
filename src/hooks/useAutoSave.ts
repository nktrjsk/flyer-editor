import { useEffect, useRef } from 'react'
import { useEvolu, type ConceptId } from '../db/schema'
import type { ConceptMeta } from '../types'

/** Debounced auto-save: writes meta + markdown to Evolu 500ms after last change */
export function useAutoSave(
  activeId: ConceptId | null,
  meta: ConceptMeta,
  markdown: string,
) {
  const { update } = useEvolu()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!activeId) return

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
        markdown,
      })
    }, 500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [activeId, meta, markdown, update])
}
