import type { PrefillUserInput, UserRecord } from '../types'

export function formatPersonName(first: string, last: string): string {
  const lastUpper = (last ?? '').trim().toUpperCase()
  const firstLower = (first ?? '').trim().toLowerCase()
  if (!firstLower) {
    return lastUpper
  }
  const chars = Array.from(firstLower)
  if (chars.length > 0) {
    chars[0] = chars[0].toUpperCase()
  }
  const formattedFirst = chars.join('')
  return [lastUpper, formattedFirst].filter(Boolean).join(' ')
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function createUserRecord(input: PrefillUserInput): UserRecord {
  return {
    id: makeId(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim()
  }
}
