import type { DerivedPage, LayoutKey, SharedFields } from '../types'
import { formatPersonName } from './names'

function numberField(value: string): string {
  if (!value) {
    return ''
  }
  const normalized = value.trim()
  if (normalized === '-1') {
    return ''
  }
  return normalized
}

function timeField(value: string): string {
  if (value === undefined || value === null || value === '') {
    return ''
  }
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) {
    return ''
  }
  return String(Math.floor(num)).padStart(2, '0')
}

export function teacherLabel(fields: SharedFields): string {
  return formatPersonName(fields.teacherFirstName, fields.teacherLastName)
}

export function resolveFieldValue(layoutKey: LayoutKey, fields: SharedFields, page: DerivedPage): string {
  switch (layoutKey) {
    case 'theme_origin':
      return fields.themeObjet
    case 'intitule':
      return fields.intitule
    case 'fonds_concerne':
      return fields.fondsConcerne
    case 'commentaire':
      return fields.comment
    case 'duree_heures':
      return numberField(fields.eventHourDuration)
    case 'duree_jours':
      return numberField(fields.eventDaysDuration)
    case 'matin_h1':
      return timeField(fields.morningStartAtHour)
    case 'matin_m1':
      return timeField(fields.morningStartAtMinute)
    case 'matin_h2':
      return timeField(fields.morningEndAtHour)
    case 'matin_m2':
      return timeField(fields.morningEndAtMinute)
    case 'aprem_h1':
      return timeField(fields.afternoonStartAtHour)
    case 'aprem_m1':
      return timeField(fields.afternoonStartAtMinute)
    case 'aprem_h2':
      return timeField(fields.afternoonEndAtHour)
    case 'aprem_m2':
      return timeField(fields.afternoonEndAtMinute)
    case 'nom_surveillant':
      return teacherLabel(fields)
    case 'date':
      return fields.dateString
    case 'pagination':
      return fields.hideTotalPagination ? `${page.index}/` : `${page.index}/${page.total}`
    default:
      return ''
  }
}
