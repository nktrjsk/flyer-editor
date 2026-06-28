import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastOptions {
  message: string
  action?: ToastAction
  durationMs?: number
}

interface ToastItem extends ToastOptions {
  id: number
  visible: boolean
}

interface ToastContextValue {
  showToast: (opts: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((opts: ToastOptions) => {
    const id = nextId.current++
    const duration = opts.durationMs ?? (opts.action ? 8000 : 4000)

    // Add toast (invisible first for transition)
    setToasts(prev => [...prev, { ...opts, id, visible: false }])

    // Make visible after a tick
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: true } : t))
      })
    })

    // Auto-dismiss
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t))
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 300)
    }, duration)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast${toast.visible ? ' toast--visible' : ''}`}>
            <span className="toast-message">{toast.message}</span>
            {toast.action && (
              <button
                className="toast-action"
                onClick={() => {
                  toast.action!.onClick()
                  setToasts(prev => prev.filter(t => t.id !== toast.id))
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
