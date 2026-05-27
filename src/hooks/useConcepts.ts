import { useQuery } from '@evolu/react'
import { allConceptsQuery } from '../db/schema'

/** Returns the list of all non-deleted concepts for the sidebar. Suspends. */
export function useConcepts() {
  return useQuery(allConceptsQuery)
}
