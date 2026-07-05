import { useMemo, useSyncExternalStore } from 'react'
import { useQuery } from '@evolu/react'
import { sqliteTrue } from '@evolu/common'
import { allOrganizationsQuery, useEvolu, type OrganizationId } from '../db/schema'

const LS_KEY = 'flyer-editor:activeOrganizationId'

/** A workspace as the UI consumes it — web coerced to a plain string. */
export interface Organization {
  id: OrganizationId
  name: string
  web: string
}

// ── active-org localStorage sync ──────────────────────────
// Mirrors useActiveConcept: the active workspace is a device-local view choice,
// not synced data. null = the "Vše" (All) view across every workspace.
function getActiveOrgId(): OrganizationId | null {
  return localStorage.getItem(LS_KEY) as OrganizationId | null
}

function setActiveOrgId(id: OrganizationId | null) {
  if (id) localStorage.setItem(LS_KEY, id)
  else localStorage.removeItem(LS_KEY)
  // Re-render every subscriber (mirrors useActiveConcept's local dispatch).
  window.dispatchEvent(new StorageEvent('storage'))
}

/**
 * Workspaces / organizations: the list, CRUD, and the device-local "active
 * workspace" that filters the sidebar and stamps new concepts. The active id
 * is validated against the live list, so a deleted workspace falls back to the
 * All view instead of stranding the sidebar on an empty filter.
 */
export function useOrganizations() {
  const { insert, update } = useEvolu()
  const rows = useQuery(allOrganizationsQuery)

  const organizations = useMemo<Organization[]>(
    () => rows.map(r => ({ id: r.id, name: r.name ?? '', web: String(r.web ?? '') })),
    [rows],
  )

  const storedId = useSyncExternalStore(
    cb => {
      window.addEventListener('storage', cb)
      return () => window.removeEventListener('storage', cb)
    },
    getActiveOrgId,
  )

  // Only honour a stored id that still exists; otherwise show All.
  const activeOrgId = useMemo<OrganizationId | null>(
    () => (storedId && organizations.some(o => o.id === storedId) ? storedId : null),
    [storedId, organizations],
  )

  const byId = useMemo(
    () => new Map(organizations.map(o => [o.id, o] as const)),
    [organizations],
  )

  function selectOrg(id: OrganizationId | null) {
    setActiveOrgId(id)
  }

  /** Create a workspace and make it active. Returns its id (or null on failure). */
  function createOrg(name: string, web = ''): OrganizationId | null {
    const result = insert('organization', { name, web: web || null })
    if (!result.ok) return null
    const orgId = result.value.id as OrganizationId
    setActiveOrgId(orgId)
    return orgId
  }

  function updateOrg(id: OrganizationId, patch: { name?: string; web?: string }) {
    update('organization', {
      id,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.web !== undefined ? { web: patch.web || null } : {}),
    })
  }

  /**
   * Soft-delete a workspace. Concepts keep their now-dangling organizationId
   * and simply fall back to the shared appSetting identity (byId lookup misses)
   * — no orphaned flyers, no cascade. If it was the active workspace, reset to
   * the All view.
   */
  function deleteOrg(id: OrganizationId) {
    update('organization', { id, isDeleted: sqliteTrue })
    if (activeOrgId === id) setActiveOrgId(null)
  }

  return { organizations, activeOrgId, byId, selectOrg, createOrg, updateOrg, deleteOrg }
}
