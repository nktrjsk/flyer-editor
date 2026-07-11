import { useEffect, useState } from 'react'
import HistoryPanel from './HistoryPanel'
import type { SnapshotContent } from '../types'

interface SidebarProps {
  concepts: Array<{
    id: string
    title: string
    reviewStatus?: string | null
    /** publish/release state: none = never published, clean = matches repo,
     *  drifted = working copy changed since last publish */
    releaseState?: 'none' | 'clean' | 'drifted'
    /** tooltip for the release indicator (version · date · state) */
    releaseTitle?: string
  }>
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onToggleReview: (id: string, current: string | null) => void
  onRestore: (content: SnapshotContent) => void
  onBrowse: () => void
}

type ReleaseState = 'none' | 'clean' | 'drifted'

interface PersistedFilter {
  release: Record<ReleaseState, boolean>
  reviewOnly: boolean
}

const FILTER_STORAGE_KEY = 'flyer-editor:sidebarFilter'

const DEFAULT_FILTER: PersistedFilter = {
  release: { none: true, clean: false, drifted: true },
  reviewOnly: false,
}

function loadPersistedFilter(): PersistedFilter {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY)
    if (!raw) return DEFAULT_FILTER
    const parsed = JSON.parse(raw)
    return {
      release: {
        none: parsed?.release?.none ?? DEFAULT_FILTER.release.none,
        clean: parsed?.release?.clean ?? DEFAULT_FILTER.release.clean,
        drifted: parsed?.release?.drifted ?? DEFAULT_FILTER.release.drifted,
      },
      reviewOnly: parsed?.reviewOnly ?? DEFAULT_FILTER.reviewOnly,
    }
  } catch {
    return DEFAULT_FILTER
  }
}

const RELEASE_CHIPS: Array<{ key: ReleaseState; label: string }> = [
  { key: 'none', label: 'Nepublikované' },
  { key: 'clean', label: 'Beze změny' },
  { key: 'drifted', label: 'Změněné' },
]

export default function Sidebar({
  concepts, activeId, onSelect, onNew, onDelete, onToggleReview, onRestore, onBrowse,
}: SidebarProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<PersistedFilter>(() => loadPersistedFilter())

  useEffect(() => {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filter))
  }, [filter])

  const toggleRelease = (key: ReleaseState) => {
    setFilter(f => ({ ...f, release: { ...f.release, [key]: !f.release[key] } }))
  }

  const toggleReviewOnly = () => {
    setFilter(f => ({ ...f, reviewOnly: !f.reviewOnly }))
  }

  const resetFilters = () => {
    setFilter(DEFAULT_FILTER)
    setSearch('')
  }

  const searchLower = search.trim().toLowerCase()

  const matches = (c: SidebarProps['concepts'][number]) => {
    const state: ReleaseState = c.releaseState ?? 'none'
    if (!filter.release[state]) return false
    if (searchLower && !c.title.toLowerCase().includes(searchLower)) return false
    if (filter.reviewOnly && c.reviewStatus !== 'review') return false
    return true
  }

  const visibleConcepts = concepts.filter(c => c.id === activeId || matches(c))
  const hiddenCount = concepts.length - visibleConcepts.length
  const onlyActivePinned = hiddenCount > 0 && visibleConcepts.length === 1 && visibleConcepts[0]?.id === activeId
  const noMatchesAtAll = visibleConcepts.length === 0

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-label">Koncepty</span>
        <button className="sidebar-new-btn" onClick={onNew} title="Nový koncept">+</button>
      </div>

      <div className="sidebar-filter-bar">
        <input
          type="text"
          className="sidebar-search-input"
          placeholder="Hledat…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="sidebar-chip-row">
          {RELEASE_CHIPS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`sidebar-filter-chip${filter.release[key] ? ' lit' : ''}`}
              aria-pressed={filter.release[key]}
              onClick={() => toggleRelease(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="sidebar-chip-row sidebar-chip-row-restrictive">
          <button
            type="button"
            className={`sidebar-filter-chip${filter.reviewOnly ? ' lit' : ''}`}
            aria-pressed={filter.reviewOnly}
            onClick={toggleReviewOnly}
          >
            Jen k revizi
          </button>
        </div>
      </div>

      <div className="sidebar-list">
        {visibleConcepts.map(c => {
          const forReview = c.reviewStatus === 'review'
          const published = c.releaseState === 'clean' || c.releaseState === 'drifted'
          const drifted = c.releaseState === 'drifted'
          return (
            <div
              key={c.id}
              className={`sidebar-item${c.id === activeId ? ' active' : ''}${forReview ? ' for-review' : ''}${drifted ? ' drifted' : ''}`}
              onClick={() => onSelect(c.id)}
            >
              {published && (
                <span
                  className={`sidebar-publish-dot${drifted ? ' drifted' : ''}`}
                  title={c.releaseTitle}
                  aria-label={c.releaseTitle}
                />
              )}
              <span className="sidebar-item-name">{c.title || '(bez názvu)'}</span>
              {drifted && <span className="sidebar-drift-badge" title={c.releaseTitle}>změněno</span>}
              {forReview && <span className="sidebar-review-badge">k revizi</span>}
              <button
                className="sidebar-review-btn"
                title={forReview ? 'Zrušit označení k revizi' : 'Označit k revizi'}
                aria-pressed={forReview}
                onClick={e => { e.stopPropagation(); onToggleReview(c.id, c.reviewStatus ?? null) }}
              >
                ⚑
              </button>
              <button
                className="sidebar-delete-btn"
                title="Smazat"
                onClick={e => { e.stopPropagation(); onDelete(c.id) }}
              >
                ✕
              </button>
            </div>
          )
        })}
        {noMatchesAtAll && (
          <div className="sidebar-filter-empty">žádné shody</div>
        )}
        {!noMatchesAtAll && onlyActivePinned && (
          <div className="sidebar-filter-empty">žádné další shody</div>
        )}
      </div>

      {hiddenCount > 0 && (
        <div className="sidebar-filter-footer">
          {hiddenCount} skryto filtrem · <button type="button" className="sidebar-filter-reset" onClick={resetFilters}>Zrušit</button>
        </div>
      )}

      <HistoryPanel
        activeId={activeId as import('../db/schema').ConceptId | null}
        onRestore={onRestore}
        onBrowse={onBrowse}
      />
    </div>
  )
}
