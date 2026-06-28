import HistoryPanel from './HistoryPanel'
import type { SnapshotContent } from '../types'

interface SidebarProps {
  concepts: Array<{ id: string; title: string }>
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRestore: (content: SnapshotContent) => void
  onBrowse: () => void
}

export default function Sidebar({
  concepts, activeId, onSelect, onNew, onDelete, onRestore, onBrowse,
}: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-label">Koncepty</span>
        <button className="sidebar-new-btn" onClick={onNew} title="Nový koncept">+</button>
      </div>

      <div className="sidebar-list">
        {concepts.map(c => (
          <div
            key={c.id}
            className={`sidebar-item${c.id === activeId ? ' active' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <span className="sidebar-item-name">{c.title || '(bez názvu)'}</span>
            <button
              className="sidebar-delete-btn"
              title="Smazat"
              onClick={e => { e.stopPropagation(); onDelete(c.id) }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <HistoryPanel
        activeId={activeId as import('../db/schema').ConceptId | null}
        onRestore={onRestore}
        onBrowse={onBrowse}
      />
    </div>
  )
}
