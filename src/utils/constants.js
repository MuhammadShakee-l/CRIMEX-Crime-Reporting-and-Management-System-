export const ROLES = {
  OFFICER: 'OFFICER',
  STATION_ADMIN: 'STATION_ADMIN',
  SYS_ADMIN: 'SYS_ADMIN',
  CITIZEN: 'CITIZEN'
}

export const ROLE_LABELS = {
  OFFICER: 'LEO',
  STATION_ADMIN: 'Station Admin',
  SYS_ADMIN: 'System Admin',
  CITIZEN: 'Citizen'
}

export const CASE_STATUSES = {
  NEW: 'NEW',
  TRIAGED: 'TRIAGED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  CLOSED: 'CLOSED'
}

export const STATUS_FLOW = {
  NEW: ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS'],
  TRIAGED: ['ASSIGNED', 'IN_PROGRESS'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: [],
  CLOSED: []
}

export const CLOSURE_REASONS = [
  'Resolved',
  'Insufficient Evidence',
  'False Report',
  'Other'
]