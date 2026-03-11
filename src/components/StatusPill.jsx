import React from 'react'
const StatusPill = ({ status }) => {
  return (
    <span className={`status-pill status-${status}`}>
      {status.replace('_',' ')}
    </span>
  )
}
export default StatusPill