import type { SharedFields, LayoutKey } from '../types'
import { NAMES_PER_PAGE } from './pages'
import { pageLayout } from '../layout/pageLayout'

const SIGNATURE_DAY_COUNT = 5
const SLOT_TYPES = ['morning', 'afternoon'] as const
export const SIGNATURE_COLUMNS = SIGNATURE_DAY_COUNT * SLOT_TYPES.length
export const SIGNATURE_ROWS = NAMES_PER_PAGE
const SIGNATURE_KEYS: LayoutKey[] = [
  'signature_col_morning1',
  'signature_col_afternoon1',
  'signature_col_morning2',
  'signature_col_afternoon2',
  'signature_col_morning3',
  'signature_col_afternoon3',
  'signature_col_morning4',
  'signature_col_afternoon4',
  'signature_col_morning5',
  'signature_col_afternoon5'
]

const MORNING_FIELDS: (keyof SharedFields)[] = [
  'morningStartAtHour',
  'morningStartAtMinute',
  'morningEndAtHour',
  'morningEndAtMinute'
]

const AFTERNOON_FIELDS: (keyof SharedFields)[] = [
  'afternoonStartAtHour',
  'afternoonStartAtMinute',
  'afternoonEndAtHour',
  'afternoonEndAtMinute'
]

function hasSlotValue(fields: SharedFields, keys: (keyof SharedFields)[]) {
  return keys.some((key) => {
    const value = fields[key]
    return typeof value === 'string' ? value.trim() : Boolean(value)
  })
}

function parseDayCount(fields: SharedFields) {
  const value = Number(fields.eventDaysDuration)
  if (Number.isFinite(value) && value > 0) {
    return Math.min(SIGNATURE_DAY_COUNT, Math.ceil(value))
  }
  return SIGNATURE_DAY_COUNT
}

export function getSignatureColumnStates(sharedFields: SharedFields): boolean[] {
  const dayCount = parseDayCount(sharedFields)
  const morningEnabled = hasSlotValue(sharedFields, MORNING_FIELDS)
  const afternoonEnabled = hasSlotValue(sharedFields, AFTERNOON_FIELDS)
  const states: boolean[] = []

  for (let day = 0; day < SIGNATURE_DAY_COUNT; day += 1) {
    states.push(morningEnabled && day < dayCount)
    states.push(afternoonEnabled && day < dayCount)
  }

  return states
}

export function getSignatureColumnLayouts(pageSize: { width: number; height: number }) {
  return SIGNATURE_KEYS.map((key) => {
    const entry = pageLayout[key]
    if (!entry) return null
    const width = entry.wPercent * pageSize.width
    const height = entry.hPercent * pageSize.height
    const x = entry.xPercent * pageSize.width
    const yFromTop = entry.yPercent * pageSize.height
    const y = pageSize.height - yFromTop - height
    return { x, y, width, height }
  })
}
