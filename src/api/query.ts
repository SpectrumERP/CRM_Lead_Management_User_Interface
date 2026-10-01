/** Build `?a=1&b=x,y` from a query object. Skips empty values. */
export function withQuery(
  path: string,
  query?: Record<string, string | number | string[] | undefined>,
) {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      params.set(key, value.join(','))
      continue
    }
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

export function splitUrl(path: string) {
  const index = path.indexOf('?')
  if (index === -1) return { pathname: path, query: {} as Record<string, string> }
  return {
    pathname: path.slice(0, index),
    query: Object.fromEntries(new URLSearchParams(path.slice(index + 1))),
  }
}

/** Query array as repeated keys (ASP.NET `int[]` binding): `key=1&key=2`. */
export function repeatedQuery(key: string, values: readonly (string | number)[]) {
  return values.map((v) => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`).join('&')
}
