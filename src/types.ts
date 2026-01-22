import { pageLayout } from './layout/pageLayout'

export type LayoutKey = keyof typeof pageLayout

export type SharedFieldName =
  | 'themeObjet'
  | 'intitule'
  | 'fondsConcerne'
  | 'comment'
  | 'eventHourDuration'
  | 'eventDaysDuration'
  | 'morningStartAtHour'
  | 'morningStartAtMinute'
  | 'morningEndAtHour'
  | 'morningEndAtMinute'
  | 'afternoonStartAtHour'
  | 'afternoonStartAtMinute'
  | 'afternoonEndAtHour'
  | 'afternoonEndAtMinute'
  | 'teacherFirstName'
  | 'teacherLastName'
  | 'dateString'
  | 'disableCrossedCells'
  | 'hideTotalPagination'
  | 'templatePath'

export type PrefillSource = 'csv' | 'event' | 'exam'

export interface SharedFields {
  themeObjet: string
  intitule: string
  fondsConcerne: string
  comment: string
  eventHourDuration: string
  eventDaysDuration: string
  morningStartAtHour: string
  morningStartAtMinute: string
  morningEndAtHour: string
  morningEndAtMinute: string
  afternoonStartAtHour: string
  afternoonStartAtMinute: string
  afternoonEndAtHour: string
  afternoonEndAtMinute: string
  teacherFirstName: string
  teacherLastName: string
  dateString: string
  disableCrossedCells: boolean
  hideTotalPagination: boolean
  templatePath: string
}

export interface PrefillUserInput {
  firstName: string
  lastName: string
}

export interface PrefillPayload {
  source: PrefillSource
  users: PrefillUserInput[]
  fields?: Partial<SharedFields>
  summary: string
}

export interface UserRecord extends PrefillUserInput {
  id: string
}

export interface DerivedPage {
  index: number
  total: number
  users: UserRecord[]
  isExtra: boolean
}
