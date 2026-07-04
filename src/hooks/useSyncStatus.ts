import { useEffect, useState } from 'react'
import { loadRelayUrl } from '../lib/relayConfig'

/**
 * Relay reachability, as observable from app code. Evolu 7.x keeps its sync
 * WebSocket inside the db worker and exposes no sync-state API (useSyncState
 * is an unimplemented stub), so we probe the same relay URL ourselves: a
 * short-lived WebSocket handshake every PROBE_INTERVAL_MS. A successful open
 * means the relay is reachable from this browser — if sync still doesn't
 * happen, the devices don't share a mnemonic. We close the probe socket
 * immediately so the free relay never holds idle connections for us.
 */
export type SyncStatus = 'checking' | 'online' | 'offline'

const PROBE_INTERVAL_MS = 30_000
const PROBE_TIMEOUT_MS = 5_000

/**
 * The relay Evolu actually syncs with — resolved once at module load, same as
 * schema.ts does at boot, so probe and instance always agree within a session.
 */
export const relayUrl: string = loadRelayUrl()

function probe(url: string): Promise<boolean> {
  return new Promise(resolve => {
    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch {
      resolve(false)
      return
    }
    const finish = (ok: boolean) => {
      clearTimeout(timer)
      ws.onopen = ws.onerror = ws.onclose = null
      try { ws.close() } catch { /* already closed */ }
      resolve(ok)
    }
    const timer = setTimeout(() => finish(false), PROBE_TIMEOUT_MS)
    ws.onopen = () => finish(true)
    ws.onerror = () => finish(false)
    ws.onclose = () => finish(false)
  })
}

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>('checking')

  useEffect(() => {
    if (!relayUrl) return
    let cancelled = false

    const runProbe = () => {
      void probe(relayUrl).then(ok => {
        if (!cancelled) setStatus(ok ? 'online' : 'offline')
      })
    }

    const onOffline = () => setStatus('offline')
    const onVisible = () => {
      if (document.visibilityState === 'visible') runProbe()
    }

    runProbe()
    const interval = setInterval(() => {
      // Skip background tabs — a hidden tab doesn't need a fresh verdict, and
      // browsers throttle its timers anyway; visibilitychange re-probes on return.
      if (document.visibilityState === 'visible') runProbe()
    }, PROBE_INTERVAL_MS)
    window.addEventListener('online', runProbe)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener('online', runProbe)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return status
}
