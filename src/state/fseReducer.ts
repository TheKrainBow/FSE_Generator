import type { PrefillPayload, PrefillUserInput, SharedFields, UserRecord } from '../types'
import { createUserRecord } from '../lib/names'

export interface FSEState {
  users: UserRecord[]
  sharedFields: SharedFields
  extraPages: number
  statusMessage?: string
}

const TEMPLATE_PATH = import.meta.env.VITE_TEMPLATE_PATH || '/EmptyFSE.pdf'
const PREFILL_SOURCE_LABELS: Record<PrefillPayload['source'], string> = {
  csv: 'un fichier CSV',
  event: "42 Event",
  exam: "42 Exam"
}

export const initialSharedFields: SharedFields = {
  themeObjet: '',
  intitule: '',
  fondsConcerne: '',
  comment: '',
  eventHourDuration: '',
  eventDaysDuration: '',
  morningStartAtHour: '',
  morningStartAtMinute: '',
  morningEndAtHour: '',
  morningEndAtMinute: '',
  afternoonStartAtHour: '',
  afternoonStartAtMinute: '',
  afternoonEndAtHour: '',
  afternoonEndAtMinute: '',
  teacherFirstName: '',
  teacherLastName: '',
  dateString: '',
  disableCrossedCells: false,
  hideTotalPagination: false,
  templatePath: TEMPLATE_PATH
}

export const initialState: FSEState = {
  users: [],
  sharedFields: initialSharedFields,
  extraPages: 0
}

type Action =
  | { type: 'set-users'; users: UserRecord[] }
  | { type: 'add-user'; user: PrefillUserInput }
  | { type: 'insert-user-at'; index: number; user?: PrefillUserInput }
  | { type: 'remove-user'; id: string }
  | { type: 'move-user'; from: number; to: number }
  | { type: 'update-user'; id: string; patch: Partial<PrefillUserInput> }
  | { type: 'update-shared'; patch: Partial<SharedFields> }
  | { type: 'set-extra-pages'; count: number }
  | { type: 'apply-prefill'; payload: PrefillPayload }
  | { type: 'reset-empty' }
  | { type: 'set-status'; message?: string }

function recordsFromInputs(inputs: PrefillUserInput[]): UserRecord[] {
  return inputs
    .filter((item) => item.firstName?.trim() || item.lastName?.trim())
    .map((item) => createUserRecord(item))
}

function clampIndex(arr: unknown[], index: number) {
  if (index < 0) return 0
  if (index > arr.length) return arr.length
  return index
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= arr.length || to < 0 || to >= arr.length) {
    return arr
  }
  const next = arr.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function sortUsers(users: UserRecord[]): UserRecord[] {
  return users
    .slice()
    .sort((a, b) => {
      const lastA = (a.lastName || '').trim().toLowerCase()
      const lastB = (b.lastName || '').trim().toLowerCase()
      if (lastA !== lastB) {
        return lastA.localeCompare(lastB)
      }
      const firstA = (a.firstName || '').trim().toLowerCase()
      const firstB = (b.firstName || '').trim().toLowerCase()
      if (firstA !== firstB) {
        return firstA.localeCompare(firstB)
      }
      return a.id.localeCompare(b.id)
    })
}

export function fseReducer(state: FSEState, action: Action): FSEState {
  switch (action.type) {
    case 'set-users':
      return { ...state, users: sortUsers(action.users) }
    case 'add-user':
      return { ...state, users: sortUsers([...state.users, createUserRecord(action.user)]) }
    case 'insert-user-at': {
      const idx = clampIndex(state.users, action.index)
      const next = state.users.slice()
      next.splice(idx, 0, createUserRecord(action.user ?? { firstName: '', lastName: '' }))
      return { ...state, users: sortUsers(next) }
    }
    case 'remove-user':
      return { ...state, users: state.users.filter((user) => user.id !== action.id) }
    case 'move-user':
      return { ...state, users: move(state.users, action.from, action.to) }
    case 'update-user':
      return {
        ...state,
        users: sortUsers(
          state.users.map((user) => (user.id === action.id ? { ...user, ...action.patch } : user))
        )
      }
    case 'update-shared':
      return {
        ...state,
        sharedFields: { ...state.sharedFields, ...action.patch }
      }
    case 'set-extra-pages':
      if (state.extraPages === action.count) {
        return state
      }
      if (state.extraPages === 0 && action.count > 0 && !state.sharedFields.hideTotalPagination) {
        return {
          ...state,
          extraPages: Math.max(0, action.count),
          sharedFields: { ...state.sharedFields, hideTotalPagination: true }
        }
      }
      return { ...state, extraPages: Math.max(0, action.count) }
    case 'apply-prefill': {
      const records = recordsFromInputs(action.payload.users)
      const users = sortUsers(records)
      const shared = { ...state.sharedFields, ...action.payload.fields }
      shared.templatePath = state.sharedFields.templatePath || TEMPLATE_PATH
      const sourceLabel = PREFILL_SOURCE_LABELS[action.payload.source] ?? 'la source'
      return {
        ...state,
        users,
        sharedFields: shared,
        statusMessage: `Import de ${records.length} participant(s) depuis ${sourceLabel}.`
      }
    }
    case 'reset-empty':
      return { ...initialState, sharedFields: { ...initialSharedFields } }
    case 'set-status':
      return { ...state, statusMessage: action.message }
    default:
      return state
  }
}
