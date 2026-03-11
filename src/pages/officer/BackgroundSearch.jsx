import React, { useState } from 'react'
import Layout from '../../components/Layout'
import { toast } from 'react-toastify'

const OfficerBackgroundSearch = () => {
  const [mode, setMode] = useState('cnic')
  const [cnic, setCnic] = useState('')
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)

  const search = async () => {
    if (mode === 'cnic') {
      if (!/^\d{13}$/.test(cnic)) return toast.error('Enter 13-digit CNIC')
      // Demo result
      setResult({
        name: 'John Doe',
        cnic,
        previousOffenses: 1,
        notes: 'Known for petty theft, last record 2023.'
      })
    } else {
      if (!file) return toast.error('Upload a photo')
      // Demo result
      setResult({
        name: 'Unknown',
        matchConfidence: '82%',
        notes: 'Partial match against database. Verify identity.'
      })
    }
  }

  return (
    <Layout>
      <div className="card p-6 mb-6">
        <h1 className="text-xl font-display font-semibold">Search Criminal Background</h1>
        <p className="text-xs text-base-muted mt-1">Search by CNIC or upload a face photo.</p>
      </div>
      <div className="card p-6 space-y-6">
        <div className="flex gap-3">
          <button className={`btn ${mode==='cnic'?'btn-primary':'btn-secondary'}`} onClick={()=>setMode('cnic')}>Search by CNIC</button>
          <button className={`btn ${mode==='face'?'btn-primary':'btn-secondary'}`} onClick={()=>setMode('face')}>Search by Face</button>
        </div>
        {mode === 'cnic' ? (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="input-label">CNIC</label>
              <input className="input-base" placeholder="13 digits" value={cnic} onChange={(e)=>setCnic(e.target.value)} />
            </div>
          </div>
        ) : (
          <div>
            <label className="input-label">Upload Photo</label>
            <input type="file" className="input-base" accept="image/*" onChange={(e)=>setFile(e.target.files?.[0]||null)} />
          </div>
        )}
        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={search}>Search</button>
        </div>
      </div>

      {result && (
        <div className="card p-6 mt-6">
          <h2 className="text-lg font-semibold">Result</h2>
          <div className="table-wrapper mt-4">
            <table className="data-grid">
              <tbody>
                {Object.entries(result).map(([k,v])=>(
                  <tr key={k}>
                    <th className="text-left w-48 uppercase text-[11px] tracking-wider text-base-muted">{k}</th>
                    <td>{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  )
}

export default OfficerBackgroundSearch