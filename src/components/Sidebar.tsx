import HistoryPanel from './HistoryPanel'
import type { SnapshotContent } from '../types'

interface SidebarProps {
  concepts: Array<{ id: string; title: string; reviewStatus?: string | null }>
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onToggleReview: (id: string, current: string | null) => void
  onRestore: (content: SnapshotContent) => void
  onBrowse: () => void
}

export default function Sidebar({
  concepts, activeId, onSelect, onNew, onDelete, onToggleReview, onRestore, onBrowse,
}: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-label">Koncepty</span>
        <button className="sidebar-new-btn" onClick={onNew} title="Nový koncept">+</button>
      </div>

      <div className="sidebar-list">
        {concepts.map(c => {
          const forReview = c.reviewStatus === 'review'
          return (
            <div
              key={c.id}
              className={`sidebar-item${c.id === activeId ? ' active' : ''}${forReview ? ' for-review' : ''}`}
              onClick={() => onSelect(c.id)}
            >
              <span className="sidebar-item-name">{c.title || '(bez názvu)'}</span>
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
      </div>

      <HistoryPanel
        activeId={activeId as import('../db/schema').ConceptId | null}
        onRestore={onRestore}
        onBrowse={onBrowse}
      />
    </div>
  )
}
