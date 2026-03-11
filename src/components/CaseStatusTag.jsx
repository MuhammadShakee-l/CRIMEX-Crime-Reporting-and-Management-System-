import React from 'react'
import { CASE_STATUSES } from '../utils/constants'

const colors = {
  [CASE_STATUSES.NEW]: '#7c3aed',
  [CASE_STATUSES.TRIAGED]: '#0ea5e9',
  [CASE_STATUSES.ASSIGNED]: '#8b5cf6',
  [CASE_STATUSES.IN_PROGRESS]: '#f59e0b',
  [CASE_STATUSES.CLOSED]: '#10b981'
}

const CaseStatusTag = ({ status }) => {
  return (
    <span className="status-tag" style={{ background: colors[status] || '#9ca3af' }}>
      {status.replace('_', ' ')}
    </span>
  )
}
export default CaseStatusTag