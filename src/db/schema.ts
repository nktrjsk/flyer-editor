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

const ConceptLogoId = id('ConceptLogo')
type ConceptLogoId = typeof ConceptLogoId.Type
export type { ConceptLogoId }

// ── Schema ────────────────────────────────────────────────
// Logos are stored in a dedicated conceptLogo table and referenced by ID so
// that many snapshots of the same concept can share one logo row without
// duplicating the base64 payload.
// The legacy `concept.logo` field is kept for backward compatibility; new
// uploads write to conceptLogo + set logoId, and display code prefers logoId.
const Schema = {
  concept: {
    id: ConceptId,
    title: EvoluString,
    org: EvoluString,
    year: EvoluString,
    web: EvoluString,
    fontSize: FiniteNumber,
    logo: nullOr(EvoluString),       // legacy: base64 data URL or null
    logoId: nullOr(ConceptLogoId),   // preferred: reference to conceptLogo row
    palette: nullOr(EvoluString),    // 'color' | 'bw' — null treated as 'color'
    markdown: EvoluString,
  },
  conceptSnapshot: {
    id: ConceptSnapshotId,
    conceptId: ConceptId,
    label: nullOr(EvoluString),
    source: nullOr(EvoluString),
    summary: nullOr(EvoluString),
    title: EvoluString,
    org: EvoluString,
    year: EvoluString,
    web: EvoluString,
    fontSize: FiniteNumber,
    palette: nullOr(EvoluString),
    markdown: EvoluString,
    logoId: nullOr(ConceptLogoId),   // null on old snapshots → restore keeps current logo
  },
  conceptLogo: {
    id: ConceptLogoId,
    data: EvoluString,               // base64 data URL; never deleted (snapshots reference it)
  },
}

// ── Evolu instance ────────────────────────────────────────
// reloadUrl: after a reset/restore Evolu reloads all tabs to this URL.
// It defaults to "/", which on GitHub Pages (served under /flyer-editor/)
// would land on root where nothing is deployed and break the app. Use Vite's
// BASE_URL so it resolves to "/" in dev and "/flyer-editor/" in production.
export const evolu = createEvolu(evoluReactWebDeps)(Schema, {
  reloadUrl: import.meta.env.BASE_URL,
})

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

/** Full concept row + joined logo data */
export const conceptByIdQuery = (conceptId: ConceptId) =>
  evolu.createQuery(db =>
    db
      .selectFrom('concept')
      .leftJoin('conceptLogo', 'conceptLogo.id', 'concept.logoId')
      .selectAll('concept')
      .select('conceptLogo.data as logoData')
      .where('concept.id', '=', conceptId)
      .where('concept.isDeleted', 'is not', sqliteTrue),
  )

/**
 * A stable query that always returns no rows.
 * Used as a safe placeholder in useActiveConcept when activeId is null
 * so we never call useQuery with a runtime null.
 */
export const noConceptQuery = evolu.createQuery(db =>
  db
    .selectFrom('concept')
    .leftJoin('conceptLogo', 'conceptLogo.id', 'concept.logoId')
    .selectAll('concept')
    .select('conceptLogo.data as logoData')
    .where('concept.id', '=', '' as ConceptId)
    .limit(0),
)

/** Snapshots for a concept with joined logo data, newest first */
export const snapshotsByConceptQuery = (conceptId: ConceptId) =>
  evolu.createQuery(db =>
    db
      .selectFrom('conceptSnapshot')
      .leftJoin('conceptLogo', 'conceptLogo.id', 'conceptSnapshot.logoId')
      .select(['conceptSnapshot.id', 'conceptSnapshot.conceptId', 'conceptSnapshot.label',
               'conceptSnapshot.source', 'conceptSnapshot.summary', 'conceptSnapshot.title',
               'conceptSnapshot.org', 'conceptSnapshot.year', 'conceptSnapshot.web',
               'conceptSnapshot.fontSize', 'conceptSnapshot.palette', 'conceptSnapshot.markdown',
               'conceptSnapshot.createdAt', 'conceptSnapshot.logoId'])
      .select('conceptLogo.data as logoData')
      .where('conceptSnapshot.conceptId', '=', conceptId)
      .where('conceptSnapshot.isDeleted', 'is not', sqliteTrue)
      .orderBy('conceptSnapshot.createdAt', 'desc'),
  )

/** No-op snapshot query — placeholder when conceptId is null */
export const noSnapshotQuery = evolu.createQuery(db =>
  db
    .selectFrom('conceptSnapshot')
    .leftJoin('conceptLogo', 'conceptLogo.id', 'conceptSnapshot.logoId')
    .select(['conceptSnapshot.id', 'conceptSnapshot.conceptId', 'conceptSnapshot.label',
             'conceptSnapshot.source', 'conceptSnapshot.summary', 'conceptSnapshot.title',
             'conceptSnapshot.org', 'conceptSnapshot.year', 'conceptSnapshot.web',
             'conceptSnapshot.fontSize', 'conceptSnapshot.palette', 'conceptSnapshot.markdown',
             'conceptSnapshot.createdAt', 'conceptSnapshot.logoId'])
    .select('conceptLogo.data as logoData')
    .where('conceptSnapshot.id', '=', '' as ConceptSnapshotId)
    .limit(0),
)
