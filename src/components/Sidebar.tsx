import HistoryPanel from './HistoryPanel'
import type { SnapshotContent } from '../types'
import type { Organization } from '../hooks/useOrganizations'
import type { OrganizationId } from '../db/schema'

interface SidebarProps {
  concepts: Array<{ id: string; title: string; reviewStatus?: string | null }>
  activeId: string | null
  organizations: Organization[]
  activeOrgId: OrganizationId | null
  onSelectOrg: (id: OrganizationId | null) => void
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onToggleReview: (id: string, current: string | null) => void
  onRestore: (content: SnapshotContent) => void
  onBrowse: () => void
}

export default function Sidebar({
  concepts, activeId, organizations, activeOrgId, onSelectOrg,
  onSelect, onNew, onDelete, onToggleReview, onRestore, onBrowse,
}: SidebarProps) {
  const activeOrg = activeOrgId ? organizations.find(o => o.id === activeOrgId) ?? null : null

  return (
    <div className="sidebar">
      {/* Workspace switcher — only shown once there's a workspace to switch to,
          so the single-tenant experience stays uncluttered. */}
      {organizations.length > 0 && (
        <div className="sidebar-workspace">
          <label className="sidebar-workspace-label" htmlFor="workspace-select">
            Prostor
          </label>
          <select
            id="workspace-select"
            className="sidebar-workspace-select"
            value={activeOrgId ?? ''}
            onChange={e => onSelectOrg((e.target.value || null) as OrganizationId | null)}
          >
            <option value="">Všechny letáky</option>
            {organizations.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="sidebar-header">
        <span className="sidebar-label">Koncepty</span>
        <button className="sidebar-new-btn" onClick={onNew} title="Nový koncept">+</button>
      </div>

      <div className="sidebar-list">
        {concepts.length === 0 ? (
          <p className="sidebar-empty">
            {activeOrg
              ? `V prostoru „${activeOrg.name}" zatím není žádný leták. Vytvořte nový tlačítkem +.`
              : 'Zatím žádné letáky. Vytvořte nový tlačítkem +.'}
          </p>
        ) : concepts.map(c => {
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
