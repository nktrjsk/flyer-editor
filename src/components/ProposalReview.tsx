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

// org/year/web are auto-derived (identity setting + last-edit date), so
// proposals can't change them and they never appear in the diff.
const META_FIELDS: Array<[keyof ConceptMeta, string]> = [
  ['title', 'Název'],
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

  // For a create proposal: summarise the non-empty settings of the new flyer
  // and preview its body as additions (diff against empty).
  const createMeta = useMemo(() => {
    if (proposal.kind !== 'create') return []
    return META_FIELDS
      .filter(([f]) => f !== 'title') // title goes in the lead sentence
      .map(([f, label]) => ({ label, value: display(f, proposal.target.meta[f]) }))
      .filter(c => c.value !== '(prázdné)')
  }, [proposal])

  const createDiff = useMemo(() => {
    if (proposal.kind !== 'create' || !proposal.target.markdown) return []
    return computeDiff('', proposal.target.markdown)
  }, [proposal])

  const hasChanges =
    proposal.kind === 'switch' ||
    proposal.kind === 'create' ||
    metaChanges.length > 0 || diffLines.some(l => l.type !== 'unchanged')

  return (
    <div className="proposal-review">
      <div className="proposal-review-header">
        <span className="proposal-review-badge">AI</span>
        <span className="proposal-review-title">
          {proposal.kind === 'switch'
            ? 'Návrh: přepnout leták'
            : proposal.kind === 'create'
            ? 'Návrh: nový leták'
            : 'Návrh úpravy od AI'}
        </span>
      </div>

      <div className="proposal-review-body">
        {proposal.kind === 'create' ? (
          <>
            <p className="proposal-review-switch">
              AI chce vytvořit nový leták{' '}
              <strong>{proposal.target.meta.title || '(bez názvu)'}</strong>.
            </p>
            {createMeta.length > 0 && (
              <ul className="proposal-review-meta">
                {createMeta.map(c => (
                  <li key={c.label}>
                    <span className="proposal-review-meta-label">{c.label}:</span>{' '}
                    <span className="proposal-review-meta-to">{c.value}</span>
                  </li>
                ))}
              </ul>
            )}
            {createDiff.length > 0 && <DiffView lines={createDiff} />}
          </>
        ) : proposal.kind === 'switch' ? (
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
            {proposal.kind === 'switch'
              ? 'Přepnout'
              : proposal.kind === 'create'
              ? 'Vytvořit'
              : 'Přijmout'}
          </button>
        </div>
      </div>
    </div>
  )
}
