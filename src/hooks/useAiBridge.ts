import { useCallback, useEffect, useRef, useState } from 'react'
import {
  connectBridge,
  disconnectBridge,
  getBridgeStatus,
  onBridgeStatus,
  setBridgeDispatcher,
  type BridgeStatus,
} from '../lib/aiBridge'

const TOKEN_KEY = 'flyer.aiToken'
const ENABLED_KEY = 'flyer.aiEnabled'

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

  // Auto-connect on mount if the user previously enabled the bridge.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    const enabled = localStorage.getItem(ENABLED_KEY) === 'true'
    if (token && enabled) connectBridge(token)
  }, [])

  const connect = useCallback((token: string) => {
    localStorage.setItem(TOKEN_KEY, token.trim())
    localStorage.setItem(ENABLED_KEY, 'true')
    connectBridge(token.trim())
  }, [])

  const disconnect = useCallback(() => {
    localStorage.setItem(ENABLED_KEY, 'false')
    disconnectBridge()
  }, [])

  return {
    status,
    connect,
    disconnect,
    savedToken: () => localStorage.getItem(TOKEN_KEY) ?? '',
  }
}
