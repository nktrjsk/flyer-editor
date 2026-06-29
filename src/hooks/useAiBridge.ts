import { useEffect, useRef, useState } from 'react'
import {
  connectBridge,
  devInvoke,
  getBridgeStatus,
  isEnabled,
  onBridgeStatus,
  savedToken,
  setBridgeDispatcher,
  type BridgeStatus,
} from '../lib/aiBridge'

/** A map of tool name → handler. Handlers may close over live editor state. */
export type ToolHandlers = Record<string, (args: Record<string, unknown>) => Promise<unknown> | unknown>

/**
 * Wires the live editor into the AI bridge:
 *  - registers a stable dispatcher that always calls the latest handlers,
 *  - tracks connection status,
 *  - persists the token + an enabled flag so the choice survives reload.
 */
export function useAiBridge(handlers: ToolHandlers) {
  // Keep handlers fresh without re-registering the dispatcher every render.
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const [status, setStatus] = useState<BridgeStatus>(getBridgeStatus())

  useEffect(() => {
    setBridgeDispatcher((tool, args) => {
      const h = handlersRef.current[tool]
      if (!h) throw new Error(`Neznámý nástroj: ${tool}`)
      return h(args)
    })
  }, [])

  useEffect(() => onBridgeStatus(setStatus), [])

  // Dev-only: expose a direct dispatcher invoke for verification harnesses.
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__aiInvoke = devInvoke
    }
  }, [])

  // Auto-connect on mount if the user previously enabled the bridge.
  useEffect(() => {
    if (isEnabled() && savedToken()) connectBridge(savedToken())
  }, [])

  return { status }
}
