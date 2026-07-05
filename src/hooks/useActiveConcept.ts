import { useQuery } from '@evolu/react'
import { conceptByIdQuery, noConceptQuery, useEvolu, type ConceptId, type ConceptLogoId, type OrganizationId } from '../db/schema'
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
  // Prefer logoData from the join; fall back to legacy `logo` field for older rows.
  const resolvedLogo = (activeRow?.logoData ?? activeRow?.logo) ?? ''
  const meta: ConceptMeta = {
    title:    activeRow?.title    ?? DEFAULT_META.title,
    org:      activeRow?.org      ?? DEFAULT_META.org,
    year:     activeRow?.year     ?? DEFAULT_META.year,
    web:      activeRow?.web      ?? DEFAULT_META.web,
    fontSize: activeRow?.fontSize ?? DEFAULT_META.fontSize,
    logo:     resolvedLogo,
    logoId:   (activeRow?.logoId as string | null) ?? null,
    palette:  (activeRow?.palette as Palette | null) ?? 'color',
  }
  const markdown = activeRow?.markdown ?? DEFAULT_MARKDOWN

  // ── Mutations ────────────────────────────────────────────
  function selectConcept(id: ConceptId) {
    setActiveId(id)
    // Force a re-render by dispatching a storage event locally
    window.dispatchEvent(new StorageEvent('storage'))
  }

  /**
   * Create a new concept and make it active. Optionally seed it with initial
   * content/metadata — used by the AI bridge's gated `create_concept` proposal
   * so Claude can spin up a fully-populated flyer in one accepted step. Returns
   * the new concept's id (or null if the insert failed).
   */
  function createConcept(init?: {
    title?: string
    org?: string
    year?: string
    web?: string
    fontSize?: number
    palette?: Palette
    markdown?: string
    logo?: string | null
    logoId?: ConceptLogoId | null
    organizationId?: OrganizationId | null
  }): ConceptId | null {
    const result = insert('concept', {
      title:    init?.title    ?? '',
      org:      init?.org      ?? '',
      year:     init?.year     ?? String(new Date().getFullYear()),
      web:      init?.web      ?? '',
      fontSize: init?.fontSize ?? 9.5,
      logo:     init?.logo     ?? null,
      logoId:   init?.logoId   ?? null,
      palette:  init?.palette  ?? 'color',
      markdown: init?.markdown ?? '',
      publishId: null,
      organizationId: init?.organizationId ?? null,
    })
    if (result.ok) {
      const id = result.value.id as ConceptId
      setActiveId(id)
      window.dispatchEvent(new StorageEvent('storage'))
      return id
    }
    return null
  }

  function deleteConcept(id: ConceptId) {
    update('concept', { id, isDeleted: sqliteTrue })
    if (id === activeId) {
      const next = concepts.find(c => c.id !== id)
      setActiveId(next?.id ?? null)
      window.dispatchEvent(new StorageEvent('storage'))
    }
  }

  /** Insert a new logo row and return its ID. Called when the user uploads a logo. */
  function createLogo(data: string): ConceptLogoId | null {
    const result = insert('conceptLogo', { data })
    return result.ok ? result.value.id as ConceptLogoId : null
  }

  return {
    activeId,
    activeRow,
    meta,
    markdown,
    selectConcept,
    createConcept,
    deleteConcept,
    createLogo,
  }
}
