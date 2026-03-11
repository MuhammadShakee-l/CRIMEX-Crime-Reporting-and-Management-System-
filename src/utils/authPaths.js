import { ROLES } from './constants'

export const ROLE_PREFIXES = {
  [ROLES.SYS_ADMIN]: ['/admin/'],
  [ROLES.STATION_ADMIN]: ['/station/'],
  [ROLES.OFFICER]: ['/officer/'],
  [ROLES.CITIZEN]: [] // Placeholder
}

export const DEFAULT_DASHBOARD = {
  [ROLES.SYS_ADMIN]: '/admin/dashboard',
  [ROLES.STATION_ADMIN]: '/station/dashboard',
  [ROLES.OFFICER]: '/officer/dashboard',
  [ROLES.CITIZEN]: '/login'
}

export function isPathAuthorizedForRole(path, role) {
  if (!path || !role) return false
  const prefixes = ROLE_PREFIXES[role] || []
  return prefixes.some(p => path.startsWith(p))
}

export function resolvePostLoginPath(user, from) {
  if (!user) return '/login'
  if (from && isPathAuthorizedForRole(from, user.role)) {
    return from
  }
  return DEFAULT_DASHBOARD[user.role] || '/login'
}