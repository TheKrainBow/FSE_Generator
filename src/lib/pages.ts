import type { DerivedPage, UserRecord } from '../types'
import { formatPersonName } from './names'

export const NAMES_PER_PAGE = 7

export function chunkUsers(users: UserRecord[]): UserRecord[][] {
  const pages: UserRecord[][] = []
  for (let i = 0; i < users.length; i += NAMES_PER_PAGE) {
    pages.push(users.slice(i, i + NAMES_PER_PAGE))
  }
  return pages
}

export function buildPages(users: UserRecord[], extraPages: number): DerivedPage[] {
  const baseChunks = chunkUsers(users)
  const pages: DerivedPage[] = []
  baseChunks.forEach((chunk) => {
    pages.push({ index: 0, total: 0, users: chunk, isExtra: false })
  })
  for (let i = 0; i < extraPages; i += 1) {
    pages.push({ index: 0, total: 0, users: [], isExtra: true })
  }
  if (!pages.length) {
    pages.push({ index: 0, total: 0, users: [], isExtra: true })
  }
  return pages.map((page, idx, arr) => ({ ...page, index: idx + 1, total: arr.length }))
}

export function absoluteIndex(pageIndex: number, slotIndex: number): number {
  return (pageIndex - 1) * NAMES_PER_PAGE + slotIndex
}

export function pageNames(users: UserRecord[]): string[] {
  return users.map((user) => formatPersonName(user.firstName, user.lastName))
}
