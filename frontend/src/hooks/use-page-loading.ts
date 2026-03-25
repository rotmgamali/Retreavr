'use client'

import { useState, useEffect } from 'react'

/**
 * Simulates an async data-fetch loading state.
 * Replace `delay` with real data dependencies once the API is wired up.
 */
export function usePageLoading(delay = 700): boolean {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), delay)
    return () => clearTimeout(t)
  }, [delay])

  return loading
}
