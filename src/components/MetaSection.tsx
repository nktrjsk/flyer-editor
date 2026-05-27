import type { ConceptMeta } from '../types'

interface MetaSectionProps {
  meta: ConceptMeta
  onChange: (patch: Partial<ConceptMeta>) => void
}

export default function MetaSection({ meta, onChange }: MetaSectionProps) {
  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => onChange({ logo: ev.target?.result as string })
    reader.readAsDataURL(file)
  }

  return (
    <div className="meta-section">
      <div className="meta-field">
        <label>Název</label>
        <input
          type="text"
          value={meta.title}
          onChange={e => onChange({ title: e.target.value })}
        />
      </div>
      <div className="meta-field">
        <label>Organizace</label>
        <input
          type="text"
          value={meta.org}
          onChange={e => onChange({ org: e.target.value })}
        />
      </div>
      <div className="meta-field">
        <label>Rok</label>
        <input
          type="text"
          value={meta.year}
          onChange={e => onChange({ year: e.target.value })}
        />
      </div>
      <div className="meta-field">
        <label>Písmo (pt)</label>
        <input
          type="number"
          value={meta.fontSize}
          min={6}
          max={16}
          step={0.5}
          onChange={e => onChange({ fontSize: parseFloat(e.target.value) || 9.5 })}
        />
      </div>
      <div className="meta-field" style={{ gridColumn: '1 / -1' }}>
        <label>Web / odkaz</label>
        <input
          type="text"
          placeholder="samostuduj.cz"
          value={meta.web}
          onChange={e => onChange({ web: e.target.value })}
        />
      </div>
      <div className="meta-field" style={{ gridColumn: '1 / -1' }}>
        <label>Logo</label>
        <div className="logo-input-row">
          <label className="logo-btn" htmlFor="meta-logo">Vybrat soubor</label>
          <input id="meta-logo" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogo} />
          <span className="logo-filename">{meta.logo ? 'logo (načteno)' : '—'}</span>
          {meta.logo && (
            <button className="logo-clear" onClick={() => onChange({ logo: '' })}>✕</button>
          )}
        </div>
      </div>
    </div>
  )
}
