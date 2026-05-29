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
  // Track the last activeId seen by the effect so we can detect concept switches.
  const prevActiveIdRef = useRef<ConceptId | null>(null)

  useEffect(() => {
    if (!activeId) return

    // When the active concept just changed, local state (meta, markdown) may
    // still reflect the previous concept — the state sync in EditorLayout
    // hasn't committed yet. Skip scheduling a save; the next effect invocation
    // (triggered by the state-sync re-render) will have the correct values.
    const switched = prevActiveIdRef.current !== activeId
    prevActiveIdRef.current = activeId
    if (switched) {
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
  }, [activeId, meta, markdown, update])
}
