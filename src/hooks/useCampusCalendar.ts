import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchCampusCalendarMonth, type CalendarItem } from '../services/intra42'

const TTL_MS = 60_000

interface CacheEntry {
  items: CalendarItem[]
  fetchedAt: number
  promise?: Promise<CalendarItem[]>
}

const cache = new Map<string, CacheEntry>()

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

function addMonths(date: Date, delta: number) {
  const next = new Date(date.getTime())
  next.setDate(1)
  next.setMonth(next.getMonth() + delta)
  next.setHours(0, 0, 0, 0)
  return next
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric'
  }).format(date)
}

export function useCampusCalendar(campusId: number, active: boolean) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [items, setItems] = useState<CalendarItem[]>([])
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const requestSeq = useRef(0)
  const refreshTimer = useRef<number | null>(null)

  const currentKey = useMemo(() => `${campusId}:${monthKey(currentMonth)}`, [campusId, currentMonth])

  const loadMonth = useCallback(
    async (month: Date, force = false) => {
      const key = `${campusId}:${monthKey(month)}`
      const now = Date.now()
      const cached = cache.get(key)
      const isFresh = cached ? now - cached.fetchedAt < TTL_MS : false
      const cachedEntry = cached ?? undefined

      if (!force && isFresh && cachedEntry) {
        setItems(cachedEntry.items)
        setLastFetchedAt(cachedEntry.fetchedAt)
        setIsLoading(false)
        setIsRefreshing(false)
        setError('')
        return cachedEntry.items
      }

      if (cachedEntry) {
        setItems(cachedEntry.items)
        setLastFetchedAt(cachedEntry.fetchedAt)
        setIsLoading(false)
        setIsRefreshing(true)
      } else {
        setItems([])
        setLastFetchedAt(null)
        setIsLoading(true)
        setIsRefreshing(false)
      }
      setError('')

      let promise = cachedEntry?.promise
      if (!promise || (!isFresh && !cachedEntry?.promise)) {
        promise = fetchCampusCalendarMonth(campusId, month)
          .then((nextItems) => {
            cache.set(key, { items: nextItems, fetchedAt: Date.now() })
            return nextItems
          })
          .catch((fetchError) => {
            const existing = cache.get(key)
            if (existing) {
              cache.set(key, {
                items: existing.items,
                fetchedAt: existing.fetchedAt
              })
            }
            throw fetchError
          })
        cache.set(key, {
          items: cachedEntry?.items ?? [],
          fetchedAt: cachedEntry?.fetchedAt ?? 0,
          promise
        })
      }

      const requestId = ++requestSeq.current

      try {
        const nextItems = await promise
        if (requestId !== requestSeq.current) {
          return nextItems
        }
        setItems(nextItems)
        const fetchedAt = Date.now()
        setLastFetchedAt(fetchedAt)
        setIsLoading(false)
        setIsRefreshing(false)
        setError('')
        return nextItems
      } catch (err) {
        if (requestId !== requestSeq.current) {
          return []
        }
        const message = err instanceof Error ? err.message : 'Impossible de charger le calendrier.'
        if (!cachedEntry) {
          setItems([])
          setLastFetchedAt(null)
        } else {
          setLastFetchedAt(Date.now())
        }
        setIsLoading(false)
        setIsRefreshing(false)
        setError(message)
        return []
      }
    },
    [campusId]
  )

  useEffect(() => {
    if (!active) {
      return
    }
    void loadMonth(currentMonth)
  }, [active, currentMonth, loadMonth])

  useEffect(() => {
    if (!active || !lastFetchedAt) {
      if (refreshTimer.current !== null) {
        window.clearTimeout(refreshTimer.current)
        refreshTimer.current = null
      }
      return
    }

    const elapsed = Date.now() - lastFetchedAt
    const delay = Math.max(1_000, TTL_MS - elapsed)

    if (refreshTimer.current !== null) {
      window.clearTimeout(refreshTimer.current)
    }

    refreshTimer.current = window.setTimeout(() => {
      void loadMonth(currentMonth, true)
    }, delay)

    return () => {
      if (refreshTimer.current !== null) {
        window.clearTimeout(refreshTimer.current)
        refreshTimer.current = null
      }
    }
  }, [active, currentMonth, lastFetchedAt, loadMonth])

  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth((month) => addMonths(month, -1))
  }, [])

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((month) => addMonths(month, 1))
  }, [])

  const monthLabel = useMemo(() => formatMonth(currentMonth), [currentMonth])

  return {
    currentMonth,
    currentKey,
    error,
    goToNextMonth,
    goToPreviousMonth,
    items,
    isLoading,
    isRefreshing,
    lastFetchedAt,
    monthLabel
  }
}
