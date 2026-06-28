import { useMemo, useState } from 'react'
import { useQuery } from '@evolu/react'
import { snapshotsByConceptQuery, noSnapshotQuery, type ConceptId } from '../db/schema'
import type { ConceptMeta, Palette, SnapshotContent } from '../types'
import PreviewPane from './PreviewPane'
import DiffView from './DiffView'
import { computeDiff } from '../lib/diff'

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'právě teď'
  if (diffMin < 60) return `${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return 'včera'
  if (diffD < 7) return `${diffD} d`
  return new Date(isoString).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
}

function getTimeBucket(isoString: string): string {
  const d = new Date(isoString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400_000)
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (day.getTime() === today.getTime()) return 'Dnes'
  if (day.getTime() === yesterday.getTime()) return 'Včera'
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' })
}

function rowToMeta(snap: {
  title: string | null
  org: string | null
  year: string | null
  web: string | null
  fontSize: number | null
  palette: string | null
  logoData?: string | null
  logoId?: string | null
}): ConceptMeta {
  return {
    title: String(snap.title ?? ''),
    org: String(snap.org ?? ''),
    year: String(snap.year ?? ''),
    web: String(snap.web ?? ''),
    fontSize: Number(snap.fontSize ?? 9.5),
    palette: snap.palette ? (String(snap.palette) as Palette) : 'color',
    logo: snap.logoData ? String(snap.logoData) : '',
    logoId: snap.logoId ? String(snap.logoId) : null,
  }
}

interface HistoryExplorerProps {
  activeId: ConceptId | null
  onRestore: (content: SnapshotContent) => void
  onClose: () => void
}

export default function HistoryExplorer({ activeId, onRestore, onClose }: HistoryExplorerProps) {
  const query = useMemo(
    () => activeId ? snapshotsByConceptQuery(activeId) : noSnapshotQuery,
    [activeId],
  )
  const snapshots = useQuery(query)

  const [selectedIdx, setSelectedIdx] = useState(0)

  // Group by time bucket
  const grouped = useMemo(() => {
    type SnapRow = typeof snapshots[number]
    const groups: Array<{ bucket: string; items: SnapRow[] }> = []
    let currentBucket = ''
    for (const snap of snapshots) {
      const bucket = getTimeBucket(String(snap.createdAt))
      if (bucket !== currentBucket) {
        currentBucket = bucket
        groups.push({ bucket, items: [] })
      }
      groups[groups.length - 1].items.push(snap)
    }
    return groups
  }, [snapshots])

  const selected = snapshots[selectedIdx] ?? null

  // Compute diff vs previous (next in array = older since desc order)
  const prevSnap = snapshots[selectedIdx + 1] ?? null
  const diffLines = useMemo(() => {
    if (!selected || !prevSnap) return null
    return computeDiff(String(prevSnap.markdown ?? ''), String(selected.markdown ?? ''))
  }, [selected, prevSnap])

  function handleRestore() {
    if (!selected) return
    onRestore({
      title: String(selected.title ?? ''),
      org: String(selected.org ?? ''),
      year: String(selected.year ?? ''),
      web: String(selected.web ?? ''),
      fontSize: Number(selected.fontSize ?? 9.5),
      palette: selected.palette ? String(selected.palette) : null,
      markdown: String(selected.markdown ?? ''),
      logoId: selected.logoId ? String(selected.logoId) : null,
      logo: selected.logoData ? String(selected.logoData) : '',
    })
    onClose()
  }

  // Flat index counter for grouped rendering
  let flatIdx = 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="history-explorer-modal" onClick={e => e.stopPropagation()}>
        <div className="history-explorer-header">
          <div className="modal-title">Historie záloh</div>
          <button className="modal-close-btn" onClick={onClose}>Zavřít</button>
        </div>
        <div className="history-explorer-body">
          {/* Left panel */}
          <div className="history-explorer-list">
            {grouped.map(({ bucket, items }) => (
              <div key={bucket}>
                <div className="history-explorer-group-header">{bucket}</div>
                {items.map(snap => {
                  const idx = flatIdx++
                  const isManual = snap.source === null
                  const label = snap.summary
                    ? String(snap.summary)
                    : snap.label
                      ? String(snap.label)
                      : isManual ? '—' : 'auto'
                  return (
                    <div
                      key={String(snap.id)}
                      className={`history-explorer-item${idx === selectedIdx ? ' selected' : ''}`}
                      onClick={() => setSelectedIdx(idx)}
                    >
                      <span className="history-explorer-item-label">{label}</span>
                      <div className="history-explorer-item-meta">
                        <span className="history-explorer-item-time">
                          {formatRelativeTime(String(snap.createdAt))}
                        </span>
                        {isManual && <span className="snapshot-badge">záloha</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            {snapshots.length === 0 && (
              <div style={{ padding: '14px', fontSize: '10px', color: '#555' }}>
                Žádné zálohy
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="history-explorer-preview">
            {selected ? (
              <>
                <div className="history-explorer-preview-scroll">
                  <PreviewPane
                    meta={rowToMeta(selected)}
                    markdown={String(selected.markdown ?? '')}
                  />
                </div>
                {diffLines && diffLines.some(l => l.type !== 'unchanged') && (
                  <DiffView lines={diffLines} />
                )}
                <button className="history-explorer-restore-btn" onClick={handleRestore}>
                  Obnovit tuto verzi
                </button>
              </>
            ) : (
              <div style={{ color: '#555', fontSize: '10px', padding: '14px' }}>
                Vyberte zálohu ze seznamu
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
