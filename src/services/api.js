import axios from 'axios'
import '../services/mock' // Ensure mock endpoints are registered

// --------------------------------------
// Configuration
// --------------------------------------
const BASE_URL = '/api'

// Key used for persisted auth
const AUTH_STORAGE_KEY = 'CRIMEX_AUTH_V1'

// Axios instance
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000
})

// --------------------------------------
// Token Helpers
// --------------------------------------
let inMemoryToken = null

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setAuthToken(token) {
  inMemoryToken = token
  api.defaults.headers.Authorization = token ? `Bearer ${token}` : undefined
  // Also sync to storage if user object present
  const existing = getStoredAuth()
  if (existing) {
    existing.token = token
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(existing))
  }
}

export function persistAuth(user, token) {
  inMemoryToken = token
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, token }))
  api.defaults.headers.Authorization = `Bearer ${token}`
}

export function clearAuthToken() {
  inMemoryToken = null
  delete api.defaults.headers.Authorization
  try {
    const existing = getStoredAuth()
    if (existing) {
      // Preserve user? Usually we clear both.
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  } catch {/* ignore */}
}

// Initialize from storage (in case page reload)
const initAuth = getStoredAuth()
if (initAuth?.token) {
  inMemoryToken = initAuth.token
  api.defaults.headers.Authorization = `Bearer ${initAuth.token}`
}

// --------------------------------------
// Toast (optional: guard if not in React runtime)
// --------------------------------------
let toastRef = null
export function attachToast(toastLib) {
  toastRef = toastLib
}

// Safe toast wrappers
function toastInfo(msg, opts = {}) {
  if (toastRef?.info) toastRef.info(msg, opts)
}
function toastError(msg, opts = {}) {
  if (toastRef?.error) toastRef.error(msg, opts)
}

// --------------------------------------
// Request Interceptor (extendable)
// --------------------------------------
api.interceptors.request.use(
  (config) => {
    // Example dynamic header injection
    // config.headers['X-Client-Time'] = new Date().toISOString()
    return config
  },
  (error) => Promise.reject(error)
)

// --------------------------------------
// Response Interceptor
// --------------------------------------
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalized = normalizeAxiosError(error)

    // 401 handling
    if (normalized.status === 401) {
      // If token present -> maybe expired
      if (inMemoryToken) {
        toastError('Session expired. Please login again.')
        clearAuthToken()
      }
    }

    // Optionally rate limit network error toasts
    if (normalized.status === null) {
      // Network / timeout
      toastError('Network error. Check connection and retry.')
    }

    return Promise.reject(normalized)
  }
)

// --------------------------------------
// Error Normalization
// --------------------------------------
function normalizeAxiosError(error) {
  // If we already normalized, return as-is
  if (error?.__normalized) return error

  let status = null
  let message = 'Unexpected error'
  let details = undefined

  if (error.response) {
    status = error.response.status
    message =
      error.response.data?.message ||
      error.response.statusText ||
      `Request failed with status ${status}`
    details = error.response.data
  } else if (error.request) {
    message = 'No response received from server'
  } else if (error.message) {
    message = error.message
  }

  return {
    __normalized: true,
    isAxiosError: true,
    status,
    message,
    details,
    original: error
  }
}

// --------------------------------------
// Convenience Methods
// --------------------------------------
export async function get(url, config = {}) {
  const res = await api.get(url, config)
  return res.data
}

export async function post(url, data = {}, config = {}) {
  const res = await api.post(url, data, config)
  return res.data
}

export async function put(url, data = {}, config = {}) {
  const res = await api.put(url, data, config)
  return res.data
}

export async function patch(url, data = {}, config = {}) {
  const res = await api.patch(url, data, config)
  return res.data
}

export async function del(url, config = {}) {
  const res = await api.delete(url, config)
  return res.data
}

// --------------------------------------
// Higher-Level Helpers
// --------------------------------------
/**
 * login(credentials) -> { user, token }
 * Automatically persists auth and sets headers.
 */
export async function login(credentials) {
  const data = await post('/auth/login', credentials)
  persistAuth(data.user, data.token)
  return data
}

/**
 * logout() clears auth state.
 */
export function logout() {
  clearAuthToken()
  toastInfo('Logged out')
}

/**
 * fetchPendingApprovals() -> list
 * Example domain-specific helper.
 */
export async function fetchPendingApprovals() {
  return await get('/admin/pending')
}

/**
 * approvePending(id)
 */
export async function approvePending(id) {
  return await post(`/admin/pending/${id}/approve`)
}

/**
 * rejectPending(id)
 */
export async function rejectPending(id) {
  return await post(`/admin/pending/${id}/reject`)
}

// --------------------------------------
// Retry Wrapper (optional)
// --------------------------------------
export async function withRetry(fn, { retries = 2, delay = 300 } = {}) {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (err) {
      attempt++
      if (attempt > retries) throw err
      await new Promise(r => setTimeout(r, delay * attempt))
    }
  }
}

// --------------------------------------
// Export Axios Instance
// --------------------------------------
export default api