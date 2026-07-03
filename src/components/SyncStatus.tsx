import { useEffect } from 'react'
import { useEvoluError } from '@evolu/react'
import { useSyncStatus, relayUrl } from '../hooks/useSyncStatus'
import { useToast } from './ToastProvider'

/**
 * Toolbar chip showing relay reachability. "Online" means the sync server is
 * reachable from this browser — it can't see whether two devices actually
 * share an owner, so the tooltips spell out what each state does and doesn't
 * prove. Also surfaces Evolu errors (Sqlite, protocol, timestamp…) as toasts;
 * without this they only exist in evolu.getError() and the app looks fine.
 */

const LABELS: Record<ReturnType<typeof useSyncStatus>, string> = {
  checking: 'sync…',
  online: 'sync',
  offline: 'sync offline',
}

const TITLES: Record<ReturnType<typeof useSyncStatus>, string> = {
  checking: `Ověřuji spojení se synchronizačním serverem (${relayUrl})…`,
  online:
    `Synchronizační server (${relayUrl}) je dosažitelný. ` +
    'Pokud se data přesto nesynchronizují, zařízení nesdílejí stejnou ' +
    'zálohovací frázi — porovnejte ji v ⚙ Nastavení.',
  offline:
    `Synchronizační server (${relayUrl}) není dosažitelný — úpravy ` +
    'zůstávají jen v tomto prohlížeči. Zkontrolujte připojení, VPN, firewall ' +
    'nebo rozšíření blokující WebSockety.',
}

export default function SyncStatus() {
  const status = useSyncStatus()
  const evoluError = useEvoluError()
  const { showToast } = useToast()

  useEffect(() => {
    if (!evoluError) return
    console.error('Evolu error:', evoluError)
    showToast({
      message: `Chyba úložiště/synchronizace (${evoluError.type}) — detaily v konzoli prohlížeče.`,
      durationMs: 8000,
    })
  }, [evoluError, showToast])

  return (
    <span className={`sync-status sync-status--${status}`} title={TITLES[status]}>
      <span className="sync-status-dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  )
}
