import { useMemo, useState } from 'react'
import type { ConceptMeta, Proposal } from '../types'
import DiffView from './DiffView'
import { computeDiff } from '../lib/diff'

interface ProposalReviewProps {
  proposal: Proposal
  currentMeta: ConceptMeta
  currentMarkdown: string
  onAccept: () => void
  onReject: (reason?: string) => void
}

const META_FIELDS: Array<[keyof ConceptMeta, string]> = [
  ['title', 'Název'],
  ['org', 'Organizace'],
  ['year', 'Rok'],
  ['web', 'Web'],
  ['fontSize', 'Velikost písma'],
  ['palette', 'Barevnost'],
]

function display(field: keyof ConceptMeta, value: ConceptMeta[keyof ConceptMeta]): string {
  if (field === 'palette') return value === 'bw' ? 'černobíle' : 'barevně'
  const s = String(value ?? '')
  return s === '' ? '(prázdné)' : s
}

export default function ProposalReview({
  proposal,
  currentMeta,
  currentMarkdown,
  onAccept,
  onReject,
}: ProposalReviewProps) {
  const [reason, setReason] = useState('')

  // Recomputed every render → stays honest if the user keeps typing underneath.
  const metaChanges = useMemo(() => {
    if (proposal.kind !== 'edit') return []
    return META_FIELDS.filter(([f]) => currentMeta[f] !== proposal.target.meta[f]).map(([f, label]) => ({
      label,
      from: display(f, currentMeta[f]),
      to: display(f, proposal.target.meta[f]),
    }))
  }, [proposal, currentMeta])

  const diffLines = useMemo(() => {
    if (proposal.kind !== 'edit') return []
    if (currentMarkdown === proposal.target.markdown) return []
    return computeDiff(currentMarkdown, proposal.target.markdown)
  }, [proposal, currentMarkdown])

  const hasChanges =
    proposal.kind === 'switch' || metaChanges.length > 0 || diffLines.some(l => l.type !== 'unchanged')

  return (
    <div className="proposal-review">
      <div className="proposal-review-header">
        <span className="proposal-review-badge">AI</span>
        <span className="proposal-review-title">
          {proposal.kind === 'switch' ? 'Návrh: přepnout leták' : 'Návrh úpravy od AI'}
        </span>
      </div>

      <div className="proposal-review-body">
        {proposal.kind === 'switch' ? (
          <p className="proposal-review-switch">
            AI chce otevřít leták <strong>{proposal.toTitle || '(bez názvu)'}</strong>.
            Aktuální leták zůstane uložený.
          </p>
        ) : (
          <>
            {metaChanges.length > 0 && (
              <ul className="proposal-review-meta">
                {metaChanges.map(c => (
                  <li key={c.label}>
                    <span className="proposal-review-meta-label">{c.label}:</span>{' '}
                    <span className="proposal-review-meta-from">{c.from}</span>
                    {' → '}
                    <span className="proposal-review-meta-to">{c.to}</span>
                  </li>
                ))}
              </ul>
            )}
            {diffLines.some(l => l.type !== 'unchanged') ? (
              <DiffView lines={diffLines} />
            ) : metaChanges.length === 0 ? (
              <p className="proposal-review-empty">Návrh je shodný s aktuálním stavem — není co měnit.</p>
            ) : null}
          </>
        )}
      </div>

      <div className="proposal-review-footer">
        <input
          className="proposal-review-reason"
          type="text"
          placeholder="Proč zamítáš? (nepovinné)"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div className="proposal-review-actions">
          <button className="proposal-review-reject" onClick={() => onReject(reason.trim() || undefined)}>
            Zamítnout
          </button>
          <button className="proposal-review-accept" onClick={onAccept} disabled={!hasChanges}>
            {proposal.kind === 'switch' ? 'Přepnout' : 'Přijmout'}
          </button>
        </div>
      </div>
    </div>
  )
}
