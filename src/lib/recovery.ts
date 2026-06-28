/**
 * Hard reset of all local browser state for this app, used to recover from a
 * stuck boot (stale service worker, or an OPFS database the current schema
 * can't open). Clears the service worker, caches, the OPFS database and
 * localStorage, then reloads. Destructive: local (un-synced) data is lost,
 * which is why it is only ever offered behind an explicit user action.
 */
export async function resetLocalData(): Promise<void> {
  try {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
  } catch { /* ignore — best effort */ }

  try {
    if (window.caches) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
  } catch { /* ignore */ }

  try {
    const root = await navigator.storage.getDirectory()
    for await (const [name] of (root as unknown as {
      entries(): AsyncIterable<[string, FileSystemHandle]>
    }).entries()) {
      await root.removeEntry(name, { recursive: true }).catch(() => {})
    }
  } catch { /* OPFS unavailable — ignore */ }

  try { localStorage.clear() } catch { /* ignore */ }

  location.reload()
}
