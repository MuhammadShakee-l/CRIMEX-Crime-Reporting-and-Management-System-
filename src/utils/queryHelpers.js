export const getQueryParam = (name) => {
  const params = new URLSearchParams(window.location.search)
  return params.get(name)
}

export const buildQuery = (base, paramsObj) => {
  const params = new URLSearchParams()
  Object.entries(paramsObj).forEach(([k,v]) => {
    if (v !== undefined && v !== null && v !== '') params.append(k, v)
  })
  return `${base}?${params.toString()}`
}