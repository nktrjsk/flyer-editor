import { Component, useEffect, useState, type ReactNode } from 'react'
import { resetLocalData } from '../lib/recovery'

// ── Recovery panel ────────────────────────────────────────
// Shared UI offering a safe reload first, then an explicit (destructive)
// local-data reset. Used both when the boot hangs and when it throws.
function RecoveryPanel({ reason }: { reason: 'slow' | 'error' }) {
  const [resetting, setResetting] = useState(false)
  return (
    <div className="recovery-overlay">
      <div className="recovery-card">
        <p className="recovery-title">
          {reason === 'error'
            ? 'Aplikaci se nepodařilo načíst'
            : 'Načítání trvá déle než obvykle'}
        </p>
        <p className="recovery-hint">
          Někdy pomůže obnovit stránku. Pokud problém přetrvává, vymažte lokální
          data tohoto prohlížeče a zkuste to znovu.
        </p>
        <div className="recovery-actions">
          <button onClick={() => location.reload()}>Načíst znovu</button>
          <button
            className="recovery-reset"
            disabled={resetting}
            onClick={() => { setResetting(true); void resetLocalData() }}
          >
            {resetting ? 'Obnovuji…' : 'Vymazat data a obnovit'}
          </button>
        </div>
        <p className="recovery-warning">
          „Vymazat data" odstraní neuložené koncepty v tomto prohlížeči.
        </p>
      </div>
    </div>
  )
}

// ── Slow-load notice ──────────────────────────────────────
/** Renders the recovery panel only after the boot has been pending too long. */
export function SlowLoadNotice({ delayMs = 7000 }: { delayMs?: number }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(t)
  }, [delayMs])
  return show ? <RecoveryPanel reason="slow" /> : null
}

// ── Error boundary ────────────────────────────────────────
/** Catches a hard failure during Evolu/editor init and shows recovery UI
 *  instead of a blank crash. */
export class BootErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error('Editor boot failed:', error)
  }
  render() {
    if (this.state.failed) return <RecoveryPanel reason="error" />
    return this.props.children
  }
}
