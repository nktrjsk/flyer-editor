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

// ── ID types ─────────────────────────────────────────────
const ConceptId = id('Concept')
type ConceptId = typeof ConceptId.Type
export type { ConceptId }

const ConceptSnapshotId = id('ConceptSnapshot')
type ConceptSnapshotId = typeof ConceptSnapshotId.Type
export type { ConceptSnapshotId }

// ── Schema ────────────────────────────────────────────────
// Logo is nullable: null = no logo, string = base64 data URL.
// Note: Evolu mutation size limit is 640 KB — keep logos small.
// Snapshots deliberately exclude logo to avoid hitting the size limit.
const Schema = {
  concept: {
    id: ConceptId,
    title: EvoluString,      // display name, empty string = untitled
    org: EvoluString,
    year: EvoluString,
    web: EvoluString,
    fontSize: FiniteNumber,
    logo: nullOr(EvoluString), // base64 data URL or null
    palette: nullOr(EvoluString), // 'color' | 'bw' — null treated as 'color'
    markdown: EvoluString,
  },
  conceptSnapshot: {
    id: ConceptSnapshotId,
    conceptId: ConceptId,        // owning concept
    label: nullOr(EvoluString),  // optional user label; null = auto-snapshot
    source: nullOr(EvoluString), // 'auto' | null (null = manual)
    title: EvoluString,
    org: EvoluString,
    year: EvoluString,
    web: EvoluString,
    fontSize: FiniteNumber,
    palette: nullOr(EvoluString),
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

/** Snapshots for a concept, newest first */
export const snapshotsByConceptQuery = (conceptId: ConceptId) =>
  evolu.createQuery(db =>
    db
      .selectFrom('conceptSnapshot')
      .select(['id', 'conceptId', 'label', 'source', 'title', 'org', 'year',
               'web', 'fontSize', 'palette', 'markdown', 'createdAt'])
      .where('conceptId', '=', conceptId)
      .where('isDeleted', 'is not', sqliteTrue)
      .orderBy('createdAt', 'desc'),
  )

/** No-op snapshot query — placeholder when conceptId is null */
export const noSnapshotQuery = evolu.createQuery(db =>
  db
    .selectFrom('conceptSnapshot')
    .select(['id', 'conceptId', 'label', 'source', 'title', 'org', 'year',
             'web', 'fontSize', 'palette', 'markdown', 'createdAt'])
    .where('id', '=', '' as ConceptSnapshotId)
    .limit(0),
)
