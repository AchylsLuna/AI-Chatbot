const TAG_REGEX = /<[^>]*>/g

const removeControlChars = (value: string) =>
  [...value]
    .filter((character) => {
      const code = character.charCodeAt(0)
      const isAsciiControl = code <= 31 || code === 127
      const isC1Control = code >= 128 && code <= 159
      return !isAsciiControl && !isC1Control
    })
    .join('')

export const sanitizeText = (value: string): string => {
  const normalized = removeControlChars(value).trim()
  if (!normalized) return ''

  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    const parser = new DOMParser()
    const documentFragment = parser.parseFromString(normalized, 'text/html')
    return (documentFragment.body.textContent || '').trim()
  }

  return normalized.replace(TAG_REGEX, '').trim()
}

export const sanitizeOptionalText = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') return undefined
  const sanitized = sanitizeText(value)
  return sanitized || undefined
}
