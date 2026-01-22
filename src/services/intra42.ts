import type { PrefillPayload, PrefillUserInput, SharedFields } from '../types'

const API_BASE = import.meta.env.VITE_FSE_API_BASE || '/api/42'

interface APIItem {
  id: number
  name: string
  begin_at: string
  end_at: string
  location?: string
}

interface APIUserWrapper {
  user: {
    first_name: string
    last_name: string
  }
}

async function request42(path: string) {
  const url = `${API_BASE}${path}`
  const response = await fetch(url)
  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Erreur API 42 ${response.status} : ${details}`)
  }
  return response
}

async function fetchFrom42(path: string) {
  const response = await request42(path)
  return response.json()
}

async function fetchCollection<T>(path: string): Promise<T[]> {
  const perPage = 100
  const results: T[] = []
  let page = 1
  let totalPages = Infinity
  while (page <= totalPages) {
    const delimiter = path.includes('?') ? '&' : '?'
    const response = await request42(
      `${path}${delimiter}page[size]=${perPage}&page[number]=${page}`
    )
    const chunk = (await response.json()) as T[]
    if (!Array.isArray(chunk) || chunk.length === 0) {
      break
    }
    results.push(...chunk)
    const headerTotal =
      response.headers.get('X-Total-Pages') ||
      response.headers.get('x-total-pages') ||
      response.headers.get('Total-Pages')
    if (headerTotal) {
      const parsed = Number(headerTotal)
      if (Number.isFinite(parsed) && parsed > 0) {
        totalPages = parsed
      }
    } else if (chunk.length < perPage) {
      break
    }
    page += 1
  }
  return results
}

function formatName(input: PrefillUserInput): PrefillUserInput {
  return {
    firstName: (input.firstName || '').trim(),
    lastName: (input.lastName || '').trim()
  }
}

function parseAPITime(value: string): Date {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Impossible d'analyser la date ${value}`)
  }
  return parsed
}

function toParis(date: Date): Date {
  try {
    return new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  } catch {
    return date
  }
}

function durationHours(start: Date, end: Date) {
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60))
}

function splitByNoon(start: Date, end: Date) {
  const noon = new Date(start)
  noon.setHours(12, 0, 0, 0)
  const result = {
    mh1: -1,
    mm1: -1,
    mh2: -1,
    mm2: -1,
    ah1: -1,
    am1: -1,
    ah2: -1,
    am2: -1
  }
  if (end <= start) {
    return result
  }
  if (end <= noon) {
    result.mh1 = start.getHours()
    result.mm1 = start.getMinutes()
    result.mh2 = end.getHours()
    result.mm2 = end.getMinutes()
    return result
  }
  if (start >= noon) {
    result.ah1 = start.getHours()
    result.am1 = start.getMinutes()
    result.ah2 = end.getHours()
    result.am2 = end.getMinutes()
    return result
  }
  result.mh1 = start.getHours()
  result.mm1 = start.getMinutes()
  result.mh2 = 12
  result.mm2 = 0
  result.ah1 = 12
  result.am1 = 0
  result.ah2 = end.getHours()
  result.am2 = end.getMinutes()
  return result
}

function formatDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

function pad(value: number) {
  if (value < 0) return ''
  return String(value).padStart(2, '0')
}

function applyDefaults(kind: 'event' | 'exam', item: APIItem): Partial<SharedFields> {
  const start = toParis(parseAPITime(item.begin_at))
  const end = toParis(parseAPITime(item.end_at))
  const hours = durationHours(start, end)
  const days = hours > 0 ? Math.ceil(hours / 24) : 0
  const prefix = kind === 'exam' ? 'Exam' : 'Event'
  const location = (item.location ?? '').trim()
  const base: Partial<SharedFields> = {
    fondsConcerne: 'FSE+',
    comment: kind === 'exam' ? `Exam ${location}`.trim() : location,
    themeObjet: `${prefix} ${formatDate(start)}`,
    dateString: formatDate(start)
  }
  if (kind === 'event') {
    base.intitule = item.name
  }
  base.eventHourDuration = hours ? Math.round(hours).toString() : ''
  base.eventDaysDuration = days ? days.toString() : ''

  const timeSplit = splitByNoon(start, end)

  if (kind === 'exam') {
    if (start.getHours() < 12) {
      base.morningStartAtHour = pad(start.getHours())
      base.morningStartAtMinute = pad(start.getMinutes())
      base.morningEndAtHour = pad(end.getHours())
      base.morningEndAtMinute = pad(end.getMinutes())
      base.afternoonStartAtHour = '-1'
      base.afternoonStartAtMinute = '-1'
      base.afternoonEndAtHour = '-1'
      base.afternoonEndAtMinute = '-1'
    } else {
      base.morningStartAtHour = '-1'
      base.morningStartAtMinute = '-1'
      base.morningEndAtHour = '-1'
      base.morningEndAtMinute = '-1'
      base.afternoonStartAtHour = pad(start.getHours())
      base.afternoonStartAtMinute = pad(start.getMinutes())
      base.afternoonEndAtHour = pad(end.getHours())
      base.afternoonEndAtMinute = pad(end.getMinutes())
    }
  } else {
    base.morningStartAtHour = pad(timeSplit.mh1)
    base.morningStartAtMinute = pad(timeSplit.mm1)
    base.morningEndAtHour = pad(timeSplit.mh2)
    base.morningEndAtMinute = pad(timeSplit.mm2)
    base.afternoonStartAtHour = pad(timeSplit.ah1)
    base.afternoonStartAtMinute = pad(timeSplit.am1)
    base.afternoonEndAtHour = pad(timeSplit.ah2)
    base.afternoonEndAtMinute = pad(timeSplit.am2)
  }

  return base
}

function buildPayload(kind: 'event' | 'exam', id: string, item: APIItem, attendees: APIUserWrapper[]): PrefillPayload {
  const users = attendees.map((entry) =>
    formatName({ firstName: entry.user.first_name, lastName: entry.user.last_name })
  )
  return {
    source: kind,
    summary: `${kind === 'exam' ? 'Exam' : 'Event'} ${id} (${users.length} participant(s))`,
    users,
    fields: applyDefaults(kind, item)
  }
}

export async function fetchPrefill(kind: 'event' | 'exam', id: string): Promise<PrefillPayload> {
  if (!id) {
    throw new Error('Veuillez choisir un identifiant en premier.')
  }
  const resource = kind === 'event' ? 'events' : 'exams'
  const [item, attendees] = await Promise.all([
    fetchFrom42(`/${resource}/${id}`) as Promise<APIItem>,
    fetchCollection<APIUserWrapper>(`/${resource}/${id}/${kind === 'event' ? 'events_users' : 'exams_users'}`)
  ])
  return buildPayload(kind, id, item, attendees)
}
