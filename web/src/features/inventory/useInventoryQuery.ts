import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { parseQuery, toParams, type InventoryQuery } from './query'

/**
 * The inventory query, kept in React state and mirrored to the URL (T5).
 *
 * Why not read the URL directly: router navigations finish a frame later, so
 * controlled inputs bound to the URL lag behind (checkboxes flicker, fast typing
 * can drop characters). Local state updates in the same event; the URL follows.
 * Back/Forward and links still work: an outside URL change is read back in.
 */
export function useInventoryQuery() {
  const [params, setParams] = useSearchParams()
  const [query, setQueryState] = useState(() => parseQuery(params))
  const queryRef = useRef(query)
  const lastWritten = useRef(params.toString())

  // The URL changed from outside (Back/Forward, a link): adopt it.
  useEffect(() => {
    const current = params.toString()
    if (current === lastWritten.current) return
    lastWritten.current = current
    const next = parseQuery(params)
    queryRef.current = next
    setQueryState(next)
  }, [params])

  /** Merge a change. `replace` swaps the history entry (used while typing in search). */
  const setQuery = useCallback(
    (patch: Partial<InventoryQuery>, replace = false) => {
      const next = { ...queryRef.current, ...patch }
      queryRef.current = next
      setQueryState(next)
      const nextParams = toParams(next)
      lastWritten.current = nextParams.toString()
      setParams(nextParams, { replace })
    },
    [setParams],
  )

  return [query, setQuery] as const
}
