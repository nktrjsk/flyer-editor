import { useQuery } from '@evolu/react'
import { conceptByIdQuery, noConceptQuery, useEvolu, type ConceptId } from '../db/schema'
import { DEFAULT_META, DEFAULT_MARKDOWN, type ConceptMeta, type Palette } from '../types'
import { useMemo, useSyncExternalStore } from 'react'
import { sqliteTrue } from '@evolu/common'

const LS_KEY = 'flyer-editor:activeConceptId'

// ── localStorage sync ─────────────────────────────────────
function getActiveId(): ConceptId | null {
  return (localStorage.getItem(LS_KEY) as ConceptId | null)
}

function setActiveId(id: ConceptId | null) {
  if (id) localStorage.setItem(LS_KEY, id)
  else localStorage.removeItem(LS_KEY)
}

// ── Hook ──────────────────────────────────────────────────
/**
 * Returns the full row for the currently active concept and helpers to
 * create / switch / delete concepts. The concept list (sidebar) is passed in
 * so we can auto-select the newest one when nothing is stored.
 */
export function useActiveConcept(
  concepts: ReadonlyArray<{ id: ConceptId; title: string | null }>,
) {
  const { insert, update } = useEvolu()

  // Read activeId from localStorage via useSyncExternalStore for consistency
  const storedId = useSyncExternalStore(
    (cb) => {
      window.addEventListener('storage', cb)
      return () => window.removeEventListener('storage', cb)
    },
    getActiveId,
  )

  // Resolve: use stored id if it still exists in the list; otherwise fall back
  const activeId = useMemo<ConceptId | null>(() => {
    if (concepts.length === 0) return null
    if (storedId && concepts.some(c => c.id === storedId)) return storedId
    return concepts[0].id
  }, [storedId, concepts])

  // Fetch full row — suspends until ready.
  // noConceptQuery is a stable placeholder that always returns [] when there's
  // no active concept, so useQuery is never called with a runtime null.
  const query = useMemo(
    () => (activeId ? conceptByIdQuery(activeId) : noConceptQuery),
    [activeId],
  )
  const rows = useQuery(query)
  const activeRow = rows[0] ?? null

  // ── Derived form state from the DB row ──────────────────
  const meta: ConceptMeta = {
    title:    activeRow?.title    ?? DEFAULT_META.title,
    org:      activeRow?.org      ?? DEFAULT_META.org,
    year:     activeRow?.year     ?? DEFAULT_META.year,
    web:      activeRow?.web      ?? DEFAULT_META.web,
    fontSize: activeRow?.fontSize ?? DEFAULT_META.fontSize,
    logo:     activeRow?.logo     ?? '',
    palette:  (activeRow?.palette as Palette | null) ?? 'color',
  }
  const markdown = activeRow?.markdown ?? DEFAULT_MARKDOWN

  // ── Mutations ────────────────────────────────────────────
  function selectConcept(id: ConceptId) {
    setActiveId(id)
    // Force a re-render by dispatching a storage event locally
    window.dispatchEvent(new StorageEvent('storage'))
  }

  function createConcept() {
    const result = insert('concept', {
      title:    '',
      org:      '',
      year:     String(new Date().getFullYear()),
      web:      '',
      fontSize: 9.5,
      logo:     null,
      palette:  'color',
      markdown: '',
    })
    if (result.ok) {
      setActiveId(result.value.id as ConceptId)
      window.dispatchEvent(new StorageEvent('storage'))
    }
  }

  function deleteConcept(id: ConceptId) {
    update('concept', { id, isDeleted: sqliteTrue })
    if (id === activeId) {
      const next = concepts.find(c => c.id !== id)
      setActiveId(next?.id ?? null)
      window.dispatchEvent(new StorageEvent('storage'))
    }
  }

  return {
    activeId,
    activeRow,
    meta,
    markdown,
    selectConcept,
    createConcept,
    deleteConcept,
  }
}
