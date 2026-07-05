import { useEffect, useRef } from 'react'
import { useEvolu, type ConceptId, type ConceptLogoId } from '../db/schema'
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
      // org/year/web are auto-derived (identity setting + last-edit date) and
      // deliberately NOT written back — the legacy columns keep their old
      // values as a fallback for devices without the identity setting.
      update('concept', {
        id:       activeId,
        title:    meta.title,
        fontSize: meta.fontSize,
        // Once a logoId is set, clear the legacy logo field to free storage.
        // If no logoId, preserve whatever is in the legacy field.
        logo:     meta.logoId ? null : (meta.logo || null),
        logoId:   meta.logoId as ConceptLogoId | null,
        palette:  meta.palette,
        markdown,
      })
    }, 500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [activeId, meta, markdown, update, isSynced])
}
