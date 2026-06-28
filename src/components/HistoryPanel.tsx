import { useMemo, useState } from 'react'
import { useQuery } from '@evolu/react'
import {
  snapshotsByConceptQuery,
  noSnapshotQuery,
  type ConceptId,
} from '../db/schema'
import type { SnapshotContent } from '../types'

const MAX_VISIBLE = 20

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1)  return 'právě teď'
  if (diffMin < 60) return `${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)   return `${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1)  return 'včera'
  if (diffD < 7)    return `${diffD} d`
  return new Date(isoString).toLocaleDateString('cs-CZ', {
    day: 'numeric', month: 'short',
  })
}

interface HistoryPanelProps {
  activeId: ConceptId | null
  onRestore: (content: SnapshotContent) => void
  onBrowse: () => void
}

export default function HistoryPanel({ activeId, onRestore, onBrowse }: HistoryPanelProps) {
  const [expanded, setExpanded] = useState(true)

  const query = useMemo(
    () => activeId ? snapshotsByConceptQuery(activeId) : noSnapshotQuery,
    [activeId],
  )
  const snapshots = useQuery(query)

  // Only named (manual) snapshots get rows in the panel; auto snapshots stay
  // out of sight and are reachable via "Procházet historii".
  const manualSnapshots = snapshots.filter(s => s.source === null)

  // Render the panel whenever the concept has ANY history — otherwise the
  // explorer (the only place auto snapshots live) would be unreachable for a
  // concept that has auto snapshots but no named ones.
  if (!activeId || snapshots.length === 0) return null

  const visible = manualSnapshots.slice(0, MAX_VISIBLE)

  return (
    <div className="history-panel">
      <button className="history-toggle" onClick={() => setExpanded(e => !e)}>
        <span className="sidebar-label">Zálohy</span>
        <span className="history-chevron">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="history-list">
          {visible.map(snap => {
            return (
              <div
                key={snap.id as string}
                className="history-item history-item--manual"
              >
                <span className="history-item-label" title={snap.label ?? undefined}>
                  {snap.label ?? '—'}
                </span>
                <span className="history-item-time">
                  {formatRelativeTime(String(snap.createdAt))}
                </span>
                <button
                  className="history-restore-btn"
                  title="Obnovit tuto verzi"
                  onClick={() => onRestore({
                    title:    String(snap.title),
                    org:      String(snap.org),
                    year:     String(snap.year),
                    web:      String(snap.web),
                    fontSize: Number(snap.fontSize),
                    palette:  snap.palette ? String(snap.palette) : null,
                    markdown: String(snap.markdown),
                    logoId:   snap.logoId ? String(snap.logoId) : null,
                    logo:     snap.logoData ? String(snap.logoData) : '',
                  })}
                >
                  ↩
                </button>
              </div>
            )
          })}
          {manualSnapshots.length > MAX_VISIBLE && (
            <div className="history-overflow">
              +{manualSnapshots.length - MAX_VISIBLE} starších
            </div>
          )}
          <button className="history-browse-btn" onClick={onBrowse}>
            Procházet historii
          </button>
        </div>
      )}
    </div>
  )
}
