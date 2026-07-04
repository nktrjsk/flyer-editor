import { defaultDbConfig } from '@evolu/common/local-first'

/**
 * Per-device relay selection. Evolu reads its transports once at createEvolu
 * time (boot), so the URL lives in localStorage and changing it takes effect
 * after a page reload — SettingsModal reloads on save. Like the GitHub PAT,
 * this is device-local: every device that should sync together must point at
 * the same relay.
 */

const LS_KEY = 'flyer-editor:relayUrl'

/** Evolu's built-in default (wss://free.evoluhq.com). */
export const defaultRelayUrl: string =
  defaultDbConfig.transports.find(t => t.type === 'WebSocket')?.url ??
  'wss://free.evoluhq.com'

export function isValidRelayUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol
    return protocol === 'wss:' || protocol === 'ws:'
  } catch {
    return false
  }
}

/** The relay to sync with; falls back to the default on missing/invalid value. */
export function loadRelayUrl(): string {
  const stored = localStorage.getItem(LS_KEY)?.trim()
  return stored && isValidRelayUrl(stored) ? stored : defaultRelayUrl
}

/** Empty or default input clears the override so the default can evolve. */
export function saveRelayUrl(url: string): void {
  const trimmed = url.trim()
  if (!trimmed || trimmed === defaultRelayUrl) localStorage.removeItem(LS_KEY)
  else localStorage.setItem(LS_KEY, trimmed)
}
