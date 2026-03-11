import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import { toast } from 'react-toastify'
import { supabase } from '../../lib/supabase.js'
import StatusChip from '../../components/StatusChip'

/**
 * LEO Roster:
 * - Lists all LEOs
 * - Search by exact badge number, or view all
 * - Shows name, badge, and quick stats (open/closed/workload rating computed from open count)
 */
const StationLeos = () => {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [leos, setLeos] = useState([])
    const [badgeSearch, setBadgeSearch] = useState('')

    const filtered = useMemo(() => {
        const t = badgeSearch.trim()
        if (!t) return leos
        return leos.filter(l => String(l.badgeNumber) === t)
    }, [badgeSearch, leos])

    const computeWorkloadLabel = (openCount) => {
        if (openCount >= 10) return 'High'
        if (openCount >= 4) return 'Medium'
        return 'Low'
    }

    const loadLeos = async () => {
        setLoading(true)
        setError('')
        try {
            // Get station_id from logged-in station admin session
            const raw = localStorage.getItem('crimex_session')
            const session = raw ? JSON.parse(raw) : null
            let stationId = session?.profile?.station_id || null

            // Fallback: look up station_id from station_admins table if session missing it
            if (!stationId && session?.profile?.id) {
                const { data: adminRow } = await supabase
                    .from('station_admins')
                    .select('station_id')
                    .eq('id', session.profile.id)
                    .maybeSingle()
                stationId = adminRow?.station_id || null
            }

            // Only fetch LEOs belonging to this station
            let leoQuery = supabase
                .from('law_enforcement_officers')
                .select('id, full_name, badge_number, rank, is_active, station_id')
                .order('badge_number', { ascending: true })
            if (stationId) leoQuery = leoQuery.eq('station_id', stationId)

            const { data: officers, error: leoErr } = await leoQuery
            if (leoErr) throw leoErr

            // Stats per LEO
            const leoIds = (officers || []).map(o => o.id)
            let statsByLeo = {}
            if (leoIds.length) {
                const { data: assignedRows, error: assignmentsErr } = await supabase
                    .from('case_assignments')
                    .select('id, leo_id, report_id, status')
                    .in('leo_id', leoIds)
                if (assignmentsErr) throw assignmentsErr

                const reportIds = Array.from(new Set((assignedRows || []).map(r => r.report_id)))
                let statusByReport = {}
                if (reportIds.length) {
                    const { data: reports, error: reportsErr } = await supabase
                        .from('crime_reports')
                        .select('id, status')
                        .in('id', reportIds)
                    if (reportsErr) throw reportsErr
                    for (const r of reports || []) statusByReport[r.id] = r.status
                }

                for (const r of assignedRows || []) {
                    const sid = statusByReport[r.report_id]
                    const open = sid === 'assigned' || sid === 'in_progress' || sid === 'triaged' || sid === 'new'
                    statsByLeo[r.leo_id] ||= { open: 0, closed: 0 }
                    if (open) statsByLeo[r.leo_id].open += 1
                    else statsByLeo[r.leo_id].closed += 1
                }
            }

            const mapped = (officers || []).map(o => {
                const openCases = statsByLeo[o.id]?.open || 0
                const closedCases = statsByLeo[o.id]?.closed || 0
                return {
                    id: o.id,
                    name: o.full_name || '—',
                    badgeNumber: o.badge_number || '—',
                    rank: o.rank || '—',
                    isActive: o.is_active ?? true,
                    openCases,
                    closedCases,
                    workloadLabel: computeWorkloadLabel(openCases),
                }
            })
            setLeos(mapped)
        } catch (e) {
            setError(e?.message || 'Failed to load roster')
            toast.error(e?.message || 'Failed to load roster')
            setLeos([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadLeos()
    }, [])

    return (
        <Layout>
            <div className="card p-6 mb-6">
                <h1 className="text-xl font-display font-semibold">LEO Roster</h1>
                <p className="text-sm text-base-muted mt-1">Search by exact badge number or view all.</p>
                <div className="mt-4 max-w-xs">
                    <input
                        className="input-base"
                        placeholder="Badge number"
                        value={badgeSearch}
                        onChange={(e) => setBadgeSearch(e.target.value)}
                    />
                </div>
            </div>

            {error && (
                <div className="card p-4 mb-6 text-sm text-semantic-danger border border-semantic-danger/40 bg-semantic-danger/10">
                    {error}
                </div>
            )}

            {loading ? (
                <p className="text-base-muted">Loading...</p>
            ) : (
                <div className="space-y-3">
                    {filtered.map(leo => (
                        <div key={leo.id} className="card p-5 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center text-base-muted">👮</div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-semibold">{leo.name}</h3>
                                    <span className="text-xs text-base-muted">Badge: {leo.badgeNumber}</span>
                                    <StatusChip status={(leo.isActive ? 'ACTIVE' : 'INACTIVE')} />
                                </div>
                                <p className="text-xs text-base-muted mt-1">
                                    Open Cases: {leo.openCases} | Closed (Mock): {leo.closedCases} | Workload: {leo.workloadLabel}
                                </p>
                            </div>
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <div className="card p-6 text-center text-sm text-base-muted">
                            No officers match that badge number.
                        </div>
                    )}
                </div>
            )}
        </Layout>
    )
}

export default StationLeos