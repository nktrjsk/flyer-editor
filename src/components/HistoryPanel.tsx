import { useMemo, useState } from 'react'
import { useQuery } from '@evolu/react'
import {
  snapshotsByConceptQuery,
  noSnapshotQuery,
  type ConceptId,
  type ConceptSnapshotId,
} from '../db/schema'

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
  onRestore: (snapshotId: ConceptSnapshotId) => void
}

export default function HistoryPanel({ activeId, onRestore }: HistoryPanelProps) {
  const [expanded, setExpanded] = useState(true)

  const query = useMemo(
    () => activeId ? snapshotsByConceptQuery(activeId) : noSnapshotQuery,
    [activeId],
  )
  const snapshots = useQuery(query)

  if (!activeId || snapshots.length === 0) return null

  const visible = snapshots.slice(0, MAX_VISIBLE)

  return (
    <div className="history-panel">
      <button className="history-toggle" onClick={() => setExpanded(e => !e)}>
        <span className="sidebar-label">Historie</span>
        <span className="history-chevron">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="history-list">
          {visible.map(snap => {
            const isManual = snap.source === null
            return (
              <div
                key={snap.id as string}
                className={`history-item${isManual ? ' history-item--manual' : ''}`}
              >
                <span className="history-item-label" title={snap.label ?? undefined}>
                  {snap.label ?? (isManual ? '—' : 'auto')}
                </span>
                <span className="history-item-time">
                  {formatRelativeTime(String(snap.createdAt))}
                </span>
                <button
                  className="history-restore-btn"
                  title="Obnovit tuto verzi"
                  onClick={() => onRestore(snap.id as ConceptSnapshotId)}
                >
                  ↩
                </button>
              </div>
            )
          })}
          {snapshots.length > MAX_VISIBLE && (
            <div className="history-overflow">
              +{snapshots.length - MAX_VISIBLE} starších
            </div>
          )}
        </div>
      )}
    </div>
  )
}
