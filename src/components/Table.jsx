import React from 'react'

const Table = ({ columns, data, keyField = 'id', emptyText = 'No records found.' }) => {
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key || c.title}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: '1rem' }}>{emptyText}</td></tr>
          )}
          {data.map((row) => (
            <tr key={row[keyField]}>
              {columns.map((c) => (
                <td key={c.key || c.title}>
                  {c.render ? c.render(row) : row[c.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
export default Table