import type { PrefillUserInput, UserRecord } from '../types'

export function formatPersonName(first: string, last: string): string {
  const firstTrimmed = (first ?? '').trim()
  const lastUpper = (last ?? '').trim().toUpperCase()
  if (!firstTrimmed) {
    return lastUpper
  }
  const chars = Array.from(firstTrimmed.toLowerCase())
  if (chars.length > 0) {
    chars[0] = chars[0].toUpperCase()
  }
  const formattedFirst = chars.join('')
  return [formattedFirst, lastUpper].filter(Boolean).join(' ')
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
    lastName: input.lastName.trim(),
    login: input.login?.trim() || undefined
  }
}
