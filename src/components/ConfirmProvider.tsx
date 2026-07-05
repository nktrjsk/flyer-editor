import { createContext, useCallback, useContext, useState } from 'react'

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider')
  return ctx
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setState({ ...opts, resolve })
    })
  }, [])

  function handleChoice(value: boolean) {
    state?.resolve(value)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div className="modal-overlay" onClick={() => handleChoice(false)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{state.title}</div>
            <p className="modal-hint">{state.message}</p>
            <div className="modal-footer modal-footer--split">
              <button className="modal-close-btn" onClick={() => handleChoice(false)}>
                {state.cancelLabel ?? 'Zrušit'}
              </button>
              <button
                className={state.danger ? 'modal-restore-btn' : 'modal-close-btn'}
                onClick={() => handleChoice(true)}
              >
                {state.confirmLabel ?? 'Potvrdit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
