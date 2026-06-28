import { useEffect, useRef, useState } from 'react'

interface LabelModalProps {
  onConfirm: (label: string | null) => void
  onClose: () => void
}

export default function LabelModal({ onConfirm, onClose }: LabelModalProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onConfirm(value.trim() || null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 380, gap: 16 }}>
        <div className="modal-title">Uložit zálohu</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            ref={inputRef}
            type="text"
            className="meta-field input"
            placeholder="Název zálohy (volitelné)"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              background: '#232629',
              border: '1px solid #3a3d3f',
              borderRadius: 3,
              color: '#ccc9c2',
              fontFamily: 'ui-monospace, Consolas, monospace',
              fontSize: '11.5px',
              padding: '6px 10px',
              outline: 'none',
              width: '100%',
            }}
          />
          <div className="modal-footer" style={{ justifyContent: 'space-between', paddingTop: 0, borderTop: 'none' }}>
            <button type="button" className="modal-close-btn" onClick={onClose}>Zrušit</button>
            <button type="submit" className="modal-close-btn">Uložit</button>
          </div>
        </form>
      </div>
    </div>
  )
}
