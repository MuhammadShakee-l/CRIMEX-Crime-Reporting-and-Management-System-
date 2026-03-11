import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import StatusChip from '../../components/StatusChip'
import { supabase } from '../../lib/supabase.js'
import { useNavigate } from 'react-router-dom'

// Map DB status to UI badge text
function statusLabel(s) {
    switch ((s || '').toLowerCase()) {
        case 'in_progress': return 'IN PROGRESS'
        case 'closed': return 'CLOSED'
        case 'assigned': return 'ASSIGNED'
        default: return (s || 'ASSIGNED').toUpperCase()
    }
}

export default function AssignedCases() {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [items, setItems] = useState([])
    const navigate = useNavigate()

    const loadAssigned = async () => {
        setLoading(true)
        setError('')
        try {
            // 1) Get active assignments only
            const { data: assignments, error: asgErr } = await supabase
                .from('case_assignments')
                .select('report_id, leo_id, status, assigned_at, updated_at')
                .in('status', ['assigned', 'in_progress'])
                .order('updated_at', { ascending: false })
            if (asgErr) throw asgErr

            const reportIds = Array.from(new Set((assignments || []).map(a => a.report_id).filter(Boolean)))
            if (reportIds.length === 0) {
                setItems([])
                setLoading(false)
                return
            }

            // 2) Pull report details for those IDs
            const { data: reports, error: repErr } = await supabase
                .from('crime_reports')
                .select('id, case_number, category, status, updated_at')
                .in('id', reportIds)
            if (repErr) throw repErr

            // 3) Optional: pull investigator info for labels
            const leoIds = Array.from(new Set((assignments || []).map(a => a.leo_id).filter(Boolean)))
            let leosById = new Map()
            if (leoIds.length > 0) {
                const { data: leos, error: leoErr } = await supabase
                    .from('law_enforcement_officers')
                    .select('id, full_name, badge_number')
                    .in('id', leoIds)
                if (leoErr) throw leoErr
                leosById = new Map((leos || []).map(l => [l.id, l]))
            }

            // 4) Build combined list. For each report, use the most recent active assignment
            const asgByReport = new Map()
            for (const a of (assignments || [])) {
                const prev = asgByReport.get(a.report_id)
                if (!prev || new Date(a.updated_at || a.assigned_at || 0) > new Date(prev.updated_at || prev.assigned_at || 0)) {
                    asgByReport.set(a.report_id, a)
                }
            }

            const mapped = (reports || []).map(r => {
                const a = asgByReport.get(r.id)
                const leo = a ? leosById.get(a.leo_id) : null
                return {
                    reportId: r.id,
                    caseNumber: r.case_number || r.id,
                    title: r.category || 'CASE',
                    // Prefer crime_reports.status as source of truth; fallback to assignment status
                    status: r.status || a?.status || 'assigned',
                    updatedAt: r.updated_at || a?.updated_at || a?.assigned_at,
                    investigatorLabel: leo ? `${leo.full_name} (Badge ${leo.badge_number})` : '—',
                }
            })
            // Only show items where status is assigned/in_progress; exclude closed
            const active = mapped.filter(m => ['assigned', 'in_progress'].includes((m.status || '').toLowerCase()))
            setItems(active)
        } catch (e) {
            setError(e?.message || 'Failed to load assigned cases')
            setItems([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadAssigned() }, [])

    const onRefresh = async () => {
        await loadAssigned()
    }

    const cards = useMemo(() => items, [items])

    return (
        <Layout>
            <div className="card p-6 mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-display font-semibold">Assigned Cases</h1>
                    <p className="text-sm text-base-muted mt-1">Cases currently assigned to your station.</p>
                </div>
                <button className="btn" onClick={onRefresh}>Refresh</button>
            </div>

            {error && (
                <div className="card p-4 mb-6 text-sm text-semantic-danger border border-semantic-danger/40 bg-semantic-danger/10">
                    {error}
                </div>
            )}

            {loading ? (
                <p className="text-base-muted">Loading...</p>
            ) : (
                <div className="grid md:grid-cols-2 gap-4">
                    {cards.map(c => (
                        <div key={c.reportId} className="card p-5 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold">{c.title}</h3>
                                <StatusChip status={statusLabel(c.status)} />
                            </div>
                            <p className="text-xs text-base-muted">ID: {c.caseNumber}</p>
                            <p className="text-xs text-base-muted">Investigator: {c.investigatorLabel}</p>
                            <p className="text-xs text-base-muted">Updated: {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '—'}</p>
                            <div className="mt-3">
                                <button className="btn" onClick={() => navigate(`/station/case/${c.reportId}`)}>Open</button>
                            </div>
                        </div>
                    ))}

                    {cards.length === 0 && !error && (
                        <div className="card p-6 text-center text-sm text-base-muted">No active assigned cases</div>
                    )}
                </div>
            )}
        </Layout>
    )
}