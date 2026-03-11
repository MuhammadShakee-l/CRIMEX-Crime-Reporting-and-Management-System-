import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { formatDateTimePretty } from '../../utils/format'
import { loadCaseDetail } from '../../services/leoService'

const CaseFullDetail = () => {
  const { id } = useParams() // crime_reports.id (UUID)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const d = await loadCaseDetail(id)
        if (mounted) setData(d)
      } catch (e) {
        if (mounted) setError(e?.message || 'Unauthorized')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id])

  const r = data?.report
  const citizen = data?.citizen

  return (
    <Layout>
      {error && (
        <div className="mt-4 p-4 rounded-xl border border-semantic-danger/40 bg-semantic-danger/10 text-sm text-semantic-danger">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-base-muted mt-6">Loading...</p>
      ) : (
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-display font-semibold">Detailed Info</h1>
            <button className="btn btn-secondary" onClick={()=>navigate(-1)}>Back</button>
          </div>

          {!r ? (
            <p className="text-base-muted mt-4">No report found.</p>
          ) : (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-base-muted">CASE NUMBER</div>
                <div className="font-medium">{r.case_number || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-base-muted">CATEGORY</div>
                <div className="font-medium">{r.category || '—'}</div>
              </div>

              <div>
                <div className="text-xs text-base-muted">CREATED AT</div>
                <div className="font-medium">{formatDateTimePretty(r.created_at)}</div>
              </div>
              <div>
                <div className="text-xs text-base-muted">UPDATED AT</div>
                <div className="font-medium">{formatDateTimePretty(r.updated_at)}</div>
              </div>

              {/* Citizen details from users */}
              <div>
                <div className="text-xs text-base-muted">CITIZEN NAME</div>
                <div className="font-medium">{citizen?.full_name || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-base-muted">CITIZEN CNIC</div>
                <div className="font-medium">{citizen?.cnic || '—'}</div>
              </div>

              {/* Optional extended fields if present in crime_reports */}
              <div className="md:col-span-2">
                <div className="text-xs text-base-muted">DESCRIPTION</div>
                <div className="font-medium">{r.description || '—'}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-base-muted">LOCATION</div>
                <div className="font-medium">{r.location || '—'}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}

export default CaseFullDetail