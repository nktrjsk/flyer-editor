import { useEffect, useRef, useState } from 'react'
import {
  disableBridge,
  enableBridge,
  getBridgeStatus,
  isEnabled,
  onBridgeStatus,
  savedToken,
  type BridgeStatus,
} from '../lib/aiBridge'

/**
 * Toolbar control to connect this tab to the local AI bridge. Self-contained:
 * talks to the bridge module directly (the tool handlers are registered
 * separately by EditorLayout's useAiBridge). If the bridge isn't running the
 * app is unaffected — status just stays "nepřipojeno".
 */
export default function AiConnect() {
  const [status, setStatus] = useState<BridgeStatus>(getBridgeStatus())
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState(savedToken())
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => onBridgeStatus(setStatus), [])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const enabled = isEnabled()
  const label =
    status === 'connected' ? '🟢 AI připojeno'
    : status === 'connecting' ? '🟡 připojování…'
    : enabled ? '🔴 AI nepřipojeno'
    : '🤖 Připojit k AI'

  return (
    <div className="ai-connect" ref={wrapRef}>
      <button
        className={`ai-connect-btn${status === 'connected' ? ' is-connected' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Připojení k AI"
      >
        {label}
      </button>
      {open && (
        <div className="ai-connect-popover">
          <div className="ai-connect-row">
            Stav:{' '}
            <strong>
              {status === 'connected' ? 'připojeno'
                : status === 'connecting' ? 'připojování…'
                : 'nepřipojeno'}
            </strong>
          </div>
          <label className="ai-connect-field">
            <span>Token (z <code>bridge/.token</code>)</span>
            <input
              type="text"
              value={token}
              placeholder="vlož token"
              onChange={e => setToken(e.target.value)}
            />
          </label>
          <div className="ai-connect-actions">
            {enabled && (
              <button onClick={() => { disableBridge(); setOpen(false) }}>Odpojit</button>
            )}
            <button
              className="ai-connect-primary"
              disabled={!token.trim()}
              onClick={() => { enableBridge(token); setOpen(false) }}
            >
              {enabled ? 'Připojit znovu' : 'Připojit'}
            </button>
          </div>
          <p className="ai-connect-hint">
            Spusť bridge: <code>cd bridge && npm start</code> — nebo registruj v Claude
            (viz <code>docs/ai-bridge.md</code>).
          </p>
        </div>
      )}
    </div>
  )
}
