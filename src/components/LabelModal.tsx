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
      <div className="modal modal--narrow" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Uložit zálohu</div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="modal-input"
            placeholder="Název zálohy (volitelné)"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="modal-footer modal-footer--split">
            <button type="button" className="modal-close-btn" onClick={onClose}>Zrušit</button>
            <button type="submit" className="modal-close-btn">Uložit</button>
          </div>
        </form>
      </div>
    </div>
  )
}
