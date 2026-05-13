export interface SurveillantOption {
  label: string
  firstName: string
  lastName: string
}

function splitName(label: string): SurveillantOption | null {
  const trimmed = label.trim()
  if (!trimmed) {
    return null
  }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return {
      label: trimmed,
      firstName: '',
      lastName: trimmed
    }
  }
  const lastName = parts.pop() ?? ''
  return {
    label: trimmed,
    firstName: parts.join(' '),
    lastName
  }
}

export function getSurveillantOptions(): SurveillantOption[] {
  const raw = import.meta.env.VITE_SURVEILLANTS
  if (!raw) {
    console.warn('Variable not defined: VITE_SURVEILLANTS')
    return []
  }
  return raw
    .split(/[\n,;|]+/)
    .map((entry: string) => splitName(entry))
    .filter((entry: SurveillantOption | null): entry is SurveillantOption => Boolean(entry))
}

export function matchSurveillantLabel(firstName: string, lastName: string) {
  const normalizedFirst = firstName.trim().toLowerCase()
  const normalizedLast = lastName.trim().toLowerCase()
  return getSurveillantOptions().find((option) => {
    return (
      option.firstName.trim().toLowerCase() === normalizedFirst &&
      option.lastName.trim().toLowerCase() === normalizedLast
    )
  })?.label
}
