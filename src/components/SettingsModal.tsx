import { Suspense, use, useState } from 'react'
import { Mnemonic, formatMnemonicError } from '@evolu/common'
import { useEvolu } from '../db/schema'

// ── Mnemonic display ──────────────────────────────────────
// Suspends until appOwner is available (OPFS/worker init).
function MnemonicPanel() {
  const evolu = useEvolu()
  const appOwner = use(evolu.appOwner)
  const mnemonic = appOwner.mnemonic ?? ''
  const words = mnemonic ? mnemonic.split(' ') : []
  const [copied, setCopied] = useState(false)

  if (words.length === 0) {
    return <p className="modal-hint">Fráze není dostupná.</p>
  }

  function handleCopy() {
    void navigator.clipboard.writeText(mnemonic).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <>
      <div className="mnemonic-words">
        {words.map((word, i) => (
          <span key={i} className="mnemonic-word">
            <span className="mnemonic-word-index">{i + 1}.</span>
            {word}
          </span>
        ))}
      </div>
      <button className="mnemonic-copy-btn" onClick={handleCopy}>
        {copied ? '✓ Zkopírováno' : 'Kopírovat frázi'}
      </button>
    </>
  )
}

// ── Modal ─────────────────────────────────────────────────
interface SettingsModalProps {
  onClose: () => void
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const evolu = useEvolu()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

  function handleRestore(e: React.FormEvent) {
    e.preventDefault()
    const result = Mnemonic.from(input.trim())
    if (!result.ok) {
      // formatMnemonicError only handles MnemonicError; for upstream errors
      // (empty string, whitespace) show a plain message instead.
      const msg = result.error.type === 'Mnemonic'
        ? formatMnemonicError(result.error)
        : 'Zadejte platnou zálohovací frázi (12 slov oddělených mezerou).'
      setError(msg)
      return
    }
    setRestoring(true)
    // restoreAppOwner reloads the page — no need to handle the returned promise
    void evolu.restoreAppOwner(result.value)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Synchronizace</div>

        {/* ── Mnemonic display ── */}
        <p className="modal-section-label">Zálohovací fráze</p>
        <p className="modal-hint">
          Zapište si tato slova. Slouží k obnovení dat na novém zařízení.
        </p>
        <Suspense fallback={<p className="modal-hint">Načítání…</p>}>
          <MnemonicPanel />
        </Suspense>

        {/* ── Restore form ── */}
        <p className="modal-section-label" style={{ marginTop: 20 }}>
          Obnovit z jiného zařízení
        </p>
        <p className="modal-hint">
          Vložte zálohovací frázi z jiného zařízení. Lokální data budou
          nahrazena.{' '}
          <strong>Tuto akci nelze vrátit.</strong>
        </p>
        <form onSubmit={handleRestore}>
          <textarea
            className="mnemonic-input"
            placeholder="Zadejte 12 slov zálohovací fráze…"
            value={input}
            rows={3}
            onChange={e => {
              setInput(e.target.value)
              setError(null)
            }}
          />
          {error && <p className="mnemonic-error">{error}</p>}
          <button
            type="submit"
            className="modal-restore-btn"
            disabled={!input.trim() || restoring}
          >
            {restoring ? 'Obnovuji…' : 'Obnovit a restartovat'}
          </button>
        </form>

        <div className="modal-footer">
          <button className="modal-close-btn" onClick={onClose}>
            Zavřít
          </button>
        </div>
      </div>
    </div>
  )
}
