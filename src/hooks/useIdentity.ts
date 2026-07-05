import { useQuery } from '@evolu/react'
import { appSettingQuery, useEvolu, type AppSettingId } from '../db/schema'

/**
 * Shared flyer identity — the organization + web printed on every flyer.
 * Stored as a single (newest-wins) appSetting row in Evolu so it syncs across
 * devices with the mnemonic. `org`/`web` are null when the setting was never
 * saved, so callers can fall back to the legacy per-concept columns.
 */
export function useIdentity() {
  const { insert, update } = useEvolu()
  const rows = useQuery(appSettingQuery)
  const row = rows[0] ?? null

  function save(org: string, web: string) {
    if (row) update('appSetting', { id: row.id as AppSettingId, org, web })
    else insert('appSetting', { org, web })
  }

  return {
    org: row ? String(row.org ?? '') : null,
    web: row ? String(row.web ?? '') : null,
    save,
  }
}
