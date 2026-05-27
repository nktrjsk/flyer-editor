import {
  createEvolu,
  FiniteNumber,
  id,
  nullOr,
  String as EvoluString,
  sqliteTrue,
} from '@evolu/common'
import { createUseEvolu } from '@evolu/react'
import { evoluReactWebDeps } from '@evolu/react-web'

// ── ID type ──────────────────────────────────────────────
const ConceptId = id('Concept')
type ConceptId = typeof ConceptId.Type
export type { ConceptId }

// ── Schema ────────────────────────────────────────────────
// Logo is nullable: null = no logo, string = base64 data URL.
// Note: Evolu mutation size limit is 640 KB — keep logos small.
const Schema = {
  concept: {
    id: ConceptId,
    title: EvoluString,      // display name, empty string = untitled
    org: EvoluString,
    year: EvoluString,
    web: EvoluString,
    fontSize: FiniteNumber,
    logo: nullOr(EvoluString), // base64 data URL or null
    markdown: EvoluString,
  },
}

// ── Evolu instance ────────────────────────────────────────
export const evolu = createEvolu(evoluReactWebDeps)(Schema)

// ── Typed hooks ───────────────────────────────────────────
export const useEvolu = createUseEvolu(evolu)

// ── Queries ───────────────────────────────────────────────
/** Concept list for the sidebar — id + title only, ordered newest first */
export const allConceptsQuery = evolu.createQuery(db =>
  db
    .selectFrom('concept')
    .select(['id', 'title', 'createdAt'])
    .where('isDeleted', 'is not', sqliteTrue)
    .orderBy('createdAt', 'desc'),
)

/** Full concept row by id */
export const conceptByIdQuery = (conceptId: ConceptId) =>
  evolu.createQuery(db =>
    db
      .selectFrom('concept')
      .selectAll()
      .where('id', '=', conceptId)
      .where('isDeleted', 'is not', sqliteTrue),
  )

/**
 * A stable query that always returns no rows.
 * Used as a safe placeholder in useActiveConcept when activeId is null
 * so we never call useQuery with a runtime null.
 */
export const noConceptQuery = evolu.createQuery(db =>
  db
    .selectFrom('concept')
    .selectAll()
    .where('id', '=', '' as ConceptId)
    .limit(0),
)
