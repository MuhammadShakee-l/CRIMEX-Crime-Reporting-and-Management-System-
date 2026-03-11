import React from 'react'

const StatusChip = ({ status }) => {
  return (
    <span className={`status-chip status-${status}`}>
      {String(status).replace(/_/g, ' ')}
    </span>
  )
}

export default StatusChip