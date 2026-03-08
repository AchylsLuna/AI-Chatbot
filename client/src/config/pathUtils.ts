const getBasePrefix = () => {
  const base = import.meta.env.BASE_URL || '/'
  return base === '/' ? '' : base.replace(/\/$/, '')
}

const splitPathname = (path: string) => {
  const [pathname] = path.split('?')
  return pathname || '/'
}

export const normalizePath = (path: string) => {
  let cleaned = splitPathname(path)
  const basePrefix = getBasePrefix()

  if (basePrefix && (cleaned === basePrefix || cleaned.startsWith(`${basePrefix}/`))) {
    cleaned = cleaned.slice(basePrefix.length) || '/'
  }

  if (!cleaned.startsWith('/')) cleaned = `/${cleaned}`
  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1)
  }

  return cleaned
}

export const withBasePrefix = (path: string) => {
  const basePrefix = getBasePrefix()
  const normalizedPath = normalizePath(path)

  if (!basePrefix) return normalizedPath
  if (normalizedPath === '/') return basePrefix || '/'
  return `${basePrefix}${normalizedPath}`
}

export const matchesNamespace = (path: string, namespaceRoot: string) => {
  const normalizedPath = normalizePath(path)
  const normalizedRoot = normalizePath(namespaceRoot)
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`)
}
