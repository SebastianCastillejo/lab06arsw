// REST client for the blueprints CRUD API. Errors surface the backend's ProblemDetail `detail` message.
const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8080').replace(/\/$/, '')

async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`${API_BASE}/api/blueprints${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error(`No se pudo conectar con la API (${API_BASE})`)
  }
  if (!res.ok) {
    const problem = await res.json().catch(() => null)
    const err = new Error(problem?.detail ?? `Error HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.status === 204 ? null : res.json()
}

const path = (author, name) => `/${encodeURIComponent(author)}/${encodeURIComponent(name)}`

export const listByAuthor = (author) => request(`?author=${encodeURIComponent(author)}`)
export const getBlueprint = (author, name) => request(path(author, name))
export const createBlueprint = (author, name, points = []) =>
  request('', { method: 'POST', body: { author, name, points } })
export const updateBlueprint = (author, name, points) =>
  request(path(author, name), { method: 'PUT', body: { points } })
export const deleteBlueprint = (author, name) => request(path(author, name), { method: 'DELETE' })
