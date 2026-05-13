import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchPrefill, getDefaultCampusId, type CalendarItem } from '../services/intra42'
import { useCampusCalendar } from '../hooks/useCampusCalendar'
import type { PrefillPayload } from '../types'

interface CampusCalendarModalProps {
  open: boolean
  onClose: () => void
  onPrefill: (payload: PrefillPayload) => void
  hasExistingData?: boolean
}

const campusId = getDefaultCampusId()

function formatParisDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris'
  }).format(new Date(iso))
}

function formatParisTime(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris'
  }).format(new Date(iso))
}

function formatRelativeFetch(timestamp?: number | null) {
  if (!timestamp) {
    return ''
  }
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(timestamp))
}

function groupItems(items: CalendarItem[]) {
  return items.reduce<Record<string, CalendarItem[]>>((groups, item) => {
    const key = formatParisDate(item.beginAt)
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(item)
    return groups
  }, {})
}

function formatParisDayKey(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris'
  }).format(date)
}

export function CampusCalendarModal({ open, onClose, onPrefill, hasExistingData }: CampusCalendarModalProps) {
  const [selectionError, setSelectionError] = useState('')
  const [selectedId, setSelectedId] = useState<string>('')
  const listRef = useRef<HTMLDivElement | null>(null)
  const todayKey = useMemo(() => formatParisDayKey(new Date()), [])
  const autoScrolledKeyRef = useRef<string | null>(null)
  const {
    currentKey,
    error,
    goToNextMonth,
    goToPreviousMonth,
    items,
    isLoading,
    isRefreshing,
    lastFetchedAt,
    monthLabel
  } = useCampusCalendar(campusId, open)

  const groupedItems = useMemo(() => groupItems(items), [items])
  const orderedDays = useMemo(() => Object.keys(groupedItems), [groupedItems])
  const todayItems = groupedItems[todayKey] ?? []
  const statusLabel = isLoading
    ? 'Chargement du calendrier'
    : isRefreshing
      ? 'Nouveau fetch en cours'
      : lastFetchedAt
        ? `Données chargées à ${formatRelativeFetch(lastFetchedAt)}`
        : ''

  const handleSelect = async (item: CalendarItem) => {
    if (hasExistingData && !window.confirm('Changer de modèle effacera toutes les données des formulaires.')) {
      return
    }
    setSelectionError('')
    setSelectedId(`${item.kind}:${item.id}`)
    try {
      const payload = await fetchPrefill(item.kind, String(item.id))
      onPrefill(payload)
      onClose()
    } catch (err) {
      setSelectionError(err instanceof Error ? err.message : 'Impossible de charger cet event/exam.')
    } finally {
      setSelectedId('')
    }
  }

  useEffect(() => {
    if (!open) {
      autoScrolledKeyRef.current = null
      return
    }

    if (!orderedDays.length) {
      return
    }

    if (!todayItems.length) {
      autoScrolledKeyRef.current = null
      return
    }

    if (autoScrolledKeyRef.current === currentKey) {
      return
    }

    autoScrolledKeyRef.current = currentKey
    requestAnimationFrame(() => {
      const target = listRef.current?.querySelector<HTMLElement>(`[data-day-key="${todayKey}"]`)
      target?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }, [currentKey, open, orderedDays.length, todayItems.length, todayKey])

  if (!open) {
    return null
  }

  return (
    <div className="calendar-backdrop" role="presentation" onClick={onClose}>
      <div className="calendar-modal" role="dialog" aria-modal="true" aria-label="Calendrier 42" onClick={(event) => event.stopPropagation()}>
        <div className="calendar-modal-header">
          <div>
            <h3>Calendrier 42</h3>
            <p className="calendar-subtitle">Campus {campusId} - {monthLabel}</p>
          </div>
          <div className="calendar-controls">
            <button type="button" className="btn ghost" onClick={goToPreviousMonth}>
              Mois précédent
            </button>
            <button type="button" className="btn ghost" onClick={goToNextMonth}>
              Mois suivant
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>

        <div className="calendar-status-row">
          {statusLabel && <span className={`calendar-status ${isRefreshing ? 'refreshing' : ''}`}>{statusLabel}</span>}
          {error && <span className="calendar-error">{error}</span>}
          {selectionError && <span className="calendar-error">{selectionError}</span>}
        </div>

        <div className="calendar-list" ref={listRef}>
          {!orderedDays.length && !isLoading && (
            <div className="calendar-empty">
              <p>Aucun event ou exam trouvé pour ce mois.</p>
              <p className="hint">Essayez le mois précédent ou suivant.</p>
            </div>
          )}

          {orderedDays.map((day) => (
            <section
              key={day}
              className={`calendar-day-section ${day === todayKey ? 'today' : ''}`}
              data-day-key={day}
            >
              <div className="calendar-day-title">
                <span>{day}</span>
                {day === todayKey && <span className="calendar-day-badge">Aujourd’hui</span>}
              </div>
              <div className="calendar-day-items">
                {groupedItems[day].map((item) => {
                  const isSelected = selectedId === `${item.kind}:${item.id}`
                  return (
                    <button
                      key={`${item.kind}:${item.id}`}
                      type="button"
                      className={`calendar-item ${item.kind} ${day === todayKey ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => void handleSelect(item)}
                      disabled={isSelected}
                    >
                      <div className="calendar-item-main">
                        <div className="calendar-item-topline">
                          <span className="calendar-kind">{item.kind === 'exam' ? 'Exam' : 'Event'}</span>
                          <span className="calendar-time">{formatParisTime(item.beginAt)}</span>
                        </div>
                        <div className="calendar-item-name">{item.name}</div>
                        <div className="calendar-item-meta">ID {item.id}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
