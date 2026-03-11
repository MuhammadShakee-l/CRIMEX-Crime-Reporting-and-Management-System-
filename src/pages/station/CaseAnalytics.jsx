import React, { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase.js'
import { formatDateTimePretty } from '../../utils/format'
import { ChartBarIcon } from '@heroicons/react/24/outline'

const statusSteps = [
  { key: 'new', label: 'New', desc: 'Case received and logged.' },
  { key: 'triaged', label: 'Triaged', desc: 'Reviewed by station admin.' },
  { key: 'assigned', label: 'Assigned', desc: 'Assigned to an officer.' },
  { key: 'in_progress', label: 'In Progress', desc: 'LEO is working the case.' },
  { key: 'closed', label: 'Closed', desc: 'Case resolved or closed.' },
]

const CaseTimeline = ({ kase }) => {
  const current = (kase.status || 'new').toLowerCase()
  const currentIdx = statusSteps.findIndex(s => s.key === current)

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-base-muted">CASE</div>
          <div className="font-semibold text-lg">{kase.case_number || '—'}</div>
          <div className="text-sm text-base-muted">{kase.category || '—'}</div>
        </div>
        <div className="text-right text-sm text-base-muted">
          <div>Updated: {kase.updated_at ? formatDateTimePretty(kase.updated_at) : '—'}</div>
          <div className="text-xs">Created: {kase.created_at ? formatDateTimePretty(kase.created_at) : '—'}</div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {statusSteps.map((step, idx) => {
          const reached = currentIdx !== -1 && idx <= currentIdx
          const active = idx === currentIdx
          const dotClasses = reached
            ? 'bg-sky-500 border-sky-500 text-white'
            : 'bg-base-100 border-base-300 text-transparent'
          return (
            <div key={step.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${dotClasses}`}
                  title={step.label}
                >
                  ✓
                </div>
                {idx < statusSteps.length - 1 && (
                  <div className={`flex-1 w-px ${reached ? 'bg-sky-500/60' : 'bg-base-300/60'}`} />
                )}
              </div>
              <div>
                <div className={`text-sm font-semibold ${active ? 'text-sky-500' : reached ? 'text-base-content' : 'text-base-muted'}`}>{step.label}</div>
                <div className="text-xs text-base-muted">{step.desc}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const CaseAnalytics = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cases, setCases] = useState([])

  const normalizeStatus = (status) => {
    const s = (status || '').toString().toLowerCase()
    if (['new'].includes(s)) return 'new'
    if (['triaged'].includes(s)) return 'triaged'
    if (['assigned', 'accepted'].includes(s)) return 'assigned'
    if (['in_progress'].includes(s)) return 'in_progress'
    if (['closed', 'resolved'].includes(s)) return 'closed'
    return 'new'
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const raw = localStorage.getItem('crimex_session')
        const session = raw ? JSON.parse(raw) : null
        const stationId = session?.profile?.station_id || null

        // Pull all cases so analytics reflects the full set
        let query = supabase
          .from('crime_reports')
          .select('id, case_number, category, status, created_at, updated_at, assigned_station_id')
          .order('updated_at', { ascending: false })

        const { data: reports, error: qErr } = await query
        if (qErr) throw qErr

        const ids = (reports || []).map(r => r.id)
        let latestByReport = new Map()
        if (ids.length) {
          const { data: assigns, error: aErr } = await supabase
            .from('case_assignments')
            .select('report_id, status, updated_at, completed_at, started_at, accepted_at')
            .in('report_id', ids)
          if (aErr) throw aErr
          for (const a of assigns || []) {
            const effectiveUpdated = a.completed_at || a.updated_at || a.started_at || a.accepted_at
            const prev = latestByReport.get(a.report_id)
            const prevUpdated = prev ? (prev.completed_at || prev.updated_at || prev.started_at || prev.accepted_at) : null
            if (!prev || new Date(effectiveUpdated || 0) > new Date(prevUpdated || 0)) {
              latestByReport.set(a.report_id, a)
            }
          }
        }

        const merged = (reports || []).map(r => {
          const assignment = latestByReport.get(r.id)
          const derivedStatus = normalizeStatus(assignment?.status || r.status)
          const updated_at = assignment?.completed_at || assignment?.updated_at || assignment?.started_at || r.updated_at || r.created_at
          return {
            ...r,
            status: derivedStatus,
            updated_at,
          }
        })

        setCases(merged)
      } catch (e) {
        setError(e?.message || 'Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <Layout>
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-semibold">Case Analytics</h1>
            <p className="text-sm text-base-muted mt-1">Timeline view of every case status from New → Closed.</p>
          </div>
          <div className="rounded-xl bg-primary/10 border border-primary/30 p-3 text-primary flex items-center gap-2 text-sm">
            <ChartBarIcon className="h-5 w-5" />
            Live status by case
          </div>
        </div>
      </div>

      {error && (
        <div className="card p-4 mb-4 text-sm text-semantic-danger border border-semantic-danger/40 bg-semantic-danger/10">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-base-muted">Loading...</p>
      ) : cases.length === 0 ? (
        <p className="text-base-muted">No cases found for your station.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cases.map(k => (
            <CaseTimeline key={k.id} kase={k} />
          ))}
        </div>
      )}
    </Layout>
  )
}

export default CaseAnalytics
