import React from 'react'
import StatusChip from './StatusChip'

/* Responsive table that falls back to card rows on small screens */
const DataTable = ({ columns, data, keyField = 'id', emptyText = 'No records.' }) => {
  return (
    <div className="space-y-6">
      <div className="hidden md:block table-wrapper">
        <table className="data-grid">
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.key || c.title}>{c.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center py-8 text-base-muted text-sm">
                  {emptyText}
                </td>
              </tr>
            )}
            {data.map(row => (
              <tr key={row[keyField]}>
                {columns.map(c => (
                  <td key={c.key || c.title}>
                    {c.render
                      ? c.render(row)
                      : c.statusField
                        ? <StatusChip status={row[c.statusField]} />
                        : row[c.dataIndex]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Card mode */}
      <div className="md:hidden row-card-list">
        {data.length === 0 && (
          <div className="card p-6 text-center text-base-muted text-sm">{emptyText}</div>
        )}
        {data.map(row => (
          <div key={row[keyField]} className="row-card">
            {columns.map(c => (
              <div key={c.key || c.title} className="flex justify-between text-sm">
                <span className="text-base-muted">{c.title}</span>
                <span className="font-medium">
                  {c.render
                    ? c.render(row)
                    : c.statusField
                      ? <StatusChip status={row[c.statusField]} />
                      : row[c.dataIndex]}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default DataTable