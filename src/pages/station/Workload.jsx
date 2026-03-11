import React, { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { toast } from 'react-toastify'
import { supabase } from '../../lib/supabase.js'

/**
 * LEO Workload:
 * - Table of officers with open count, closed count, computed workload rating, avg resolution time
 */
const StationWorkload = () => {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [rows, setRows] = useState([])

    const computeWorkloadLabel = (openCount) => {
        if (openCount >= 10) return 'High'
        if (openCount >= 4) return 'Medium'
        return 'Low'
    }

    const load = async () => {
        setLoading(true)
        setError('')
        try {
            // Do NOT select non-existent columns like workload; use known fields only.
            const { data: officers, error: leoErr } = await supabase
                .from('law_enforcement_officers')
                .select('id, full_name, badge_number, is_active')
                .order('badge_number', { ascending: true })
            if (leoErr) throw leoErr

            const leoIds = (officers || []).map(o => o.id)

            const { data: assignments, error: assignErr } = await supabase
                .from('case_assignments')
                .select('id, report_id, leo_id, status, assigned_at, updated_at')
                .in('leo_id', leoIds)
            if (assignErr) throw assignErr

            const reportIds = Array.from(new Set((assignments || []).map(a => a.report_id)))

            const { data: reports, error: reportsErr } = await supabase
                .from('crime_reports')
                .select('id, status, updated_at')
                .in('id', reportIds.length ? reportIds : ['00000000-0000-0000-0000-000000000000'])
            if (reportsErr) throw reportsErr
            const statusByReport = {}
            for (const r of reports || []) statusByReport[r.id] = r.status

            const { data: updates, error: updatesErr } = await supabase
                .from('case_updates')
                .select('id, report_id, created_at, old_status, new_status')
                .in('report_id', reportIds.length ? reportIds : ['00000000-0000-0000-0000-000000000000'])
                .order('created_at', { ascending: true })
            if (updatesErr) throw updatesErr
            const updatesByReport = {}
            for (const u of updates || []) {
                updatesByReport[u.report_id] ||= []
                updatesByReport[u.report_id].push(u)
            }

            const stats = {}
            for (const a of assignments || []) {
                const sid = statusByReport[a.report_id]
                const open = sid === 'assigned' || sid === 'in_progress' || sid === 'triaged' || sid === 'new'
                stats[a.leo_id] ||= { open: 0, closed: 0, resolutions: [] }
                if (open) stats[a.leo_id].open += 1
                else stats[a.leo_id].closed += 1

                const evs = updatesByReport[a.report_id] || []
                const assignedEv = evs.find(e => e.new_status === 'assigned')
                const closedEv = evs.find(e => e.new_status === 'closed')
                if (assignedEv && closedEv) {
                    const t1 = new Date(assignedEv.created_at).getTime()
                    const t2 = new Date(closedEv.created_at).getTime()
                    const diffHours = (t2 - t1) / 36e5
                    if (!Number.isNaN(diffHours) && diffHours >= 0) {
                        stats[a.leo_id].resolutions.push(diffHours)
                    }
                }
            }

            const rowsMapped = (officers || []).map(o => {
                const s = stats[o.id] || { open: 0, closed: 0, resolutions: [] }
                const avg = s.resolutions.length
                    ? (s.resolutions.reduce((acc, v) => acc + v, 0) / s.resolutions.length)
                    : null
                return {
                    name: o.full_name || '—',
                    badge: o.badge_number || '—',
                    open: s.open,
                    closed: s.closed,
                    workload: computeWorkloadLabel(s.open),
                    avgResolution: avg, // hours
                }
            })

            setRows(rowsMapped)
        } catch (e) {
            setError(e?.message || 'Failed to load workload')
            toast.error(e?.message || 'Failed to load workload')
            setRows([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    return (
        <Layout>
            <div className="card p-6 mb-6">
                <h1 className="text-xl font-display font-semibold">LEO Workload</h1>
                <p className="text-sm text-base-muted mt-1">Open cases, closed count, workload rating, and average resolution time from assignment to closure.</p>
            </div>

            {error && (
                <div className="card p-4 mb-6 text-sm text-semantic-danger border border-semantic-danger/40 bg-semantic-danger/10">
                    {error}
                </div>
            )}

            {loading ? (
                <p className="text-base-muted">Loading...</p>
            ) : (
                <div className="card p-0 overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="text-left border-b border-base-200">
                                <th className="p-3">OFFICER</th>
                                <th className="p-3">BADGE</th>
                                <th className="p-3">OPEN CASES</th>
                                <th className="p-3">CLOSED</th>
                                <th className="p-3">WORKLOAD</th>
                                <th className="p-3">AVG RESOLUTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, idx) => (
                                <tr key={idx} className="border-b border-base-200">
                                    <td className="p-3">{r.name}</td>
                                    <td className="p-3">{r.badge}</td>
                                    <td className="p-3">{r.open}</td>
                                    <td className="p-3">{r.closed}</td>
                                    <td className="p-3">{r.workload}</td>
                                    <td className="p-3">{r.avgResolution != null ? `${r.avgResolution.toFixed(1)} h` : 'N/A'}</td>
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr><td className="p-4 text-base-muted" colSpan={6}>No data</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </Layout>
    )
}

export default StationWorkload