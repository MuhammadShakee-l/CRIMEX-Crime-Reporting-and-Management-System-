import React, { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import StatusChip from '../../components/StatusChip'
import { supabase } from '../../lib/supabase.js'
import {
    CheckCircleIcon,
    XCircleIcon,
    EyeIcon,
    ClipboardDocumentListIcon,
    ArrowPathIcon,
    PlayIcon,
} from '@heroicons/react/24/outline'

function formatDateTimePretty(dt) {
    if (!dt) return '—'
    try { return new Date(dt).toLocaleString() } catch { return dt }
}

// Parse LEO remarks from assignment_notes
// Format: "CLOSURE_REQUEST | Reason: X | Remarks: Y"
function parseLeoNotes(notes) {
    if (!notes) return { reason: '—', remarks: '—' }
    const reasonMatch = notes.match(/Reason:\s*([^|]+)/i)
    const remarksMatch = notes.match(/Remarks:\s*(.*)/i)
    return {
        reason: reasonMatch ? reasonMatch[1].trim() : '—',
        remarks: remarksMatch ? remarksMatch[1].trim() : '—',
    }
}

// ── Detail Modal ────────────────────────────────────────────────────────────
const DetailModal = ({ open, onClose, item }) => {
    if (!open || !item) return null

    const { reason, remarks } = parseLeoNotes(item.assignment_notes)
    const r = item.report || {}
    const leo = item.leo || {}
    const citizen = item.citizen || {}

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-xl font-semibold text-white">Case #{r.case_number || r.id || '—'}</h3>
                            <p className="text-xs text-white/60 mt-1">Closure request details</p>
                        </div>
                        <button className="btn btn-muted btn-sm" onClick={onClose}>Close</button>
                    </div>

                    {/* Case Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                            <div className="text-xs text-white/60 mb-1">CASE TITLE</div>
                            <div className="text-white font-medium">{r.category || '—'}</div>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                            <div className="text-xs text-white/60 mb-1">CITIZEN CNIC</div>
                            <div className="text-white font-medium">{citizen.cnic || '—'}</div>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                            <div className="text-xs text-white/60 mb-1">REPORTED AT</div>
                            <div className="text-white font-medium">{formatDateTimePretty(r.created_at)}</div>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                            <div className="text-xs text-white/60 mb-1">ASSIGNED OFFICER</div>
                            <div className="text-white font-medium">
                                {leo.full_name || '—'}
                                {leo.badge_number ? ` (Badge #${leo.badge_number})` : ''}
                            </div>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                            <div className="text-xs text-white/60 mb-1">ASSIGNED AT</div>
                            <div className="text-white font-medium">{formatDateTimePretty(item.assigned_at)}</div>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                            <div className="text-xs text-white/60 mb-1">REQUEST SENT AT</div>
                            <div className="text-white font-medium">{formatDateTimePretty(item.updated_at)}</div>
                        </div>
                    </div>

                    {/* Case Description */}
                    {r.description && (
                        <div className="rounded-xl border border-white/15 bg-white/5 p-4 mb-4">
                            <div className="text-xs text-white/60 mb-1">CASE DESCRIPTION</div>
                            <div className="text-white text-sm">{r.description}</div>
                        </div>
                    )}

                    {/* LEO Closure Request Details */}
                    <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-4">
                        <div className="text-xs text-orange-300 mb-2 font-semibold">LEO CLOSURE REQUEST</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-white/60 mb-1">CLOSURE REASON</div>
                                <div className="text-white font-medium">{reason}</div>
                            </div>
                            <div>
                                <div className="text-xs text-white/60 mb-1">OFFICER REMARKS</div>
                                <div className="text-white font-medium">{remarks}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Approve (Closure Report) Modal ─────────────────────────────────────────
const CLOSURE_REASON_OPTIONS = [
    { value: 'resolved',               label: 'Resolved' },
    { value: 'insufficient_evidence',  label: 'Insufficient Evidence' },
    { value: 'false_report',           label: 'False Report' },
    { value: 'duplicate',              label: 'Duplicate Case' },
    { value: 'withdrawn',              label: 'Withdrawn by Complainant' },
    { value: 'other',                  label: 'Other' },
]
const CLOSURE_CATEGORY_OPTIONS = [
    { value: '',                 label: '— None —' },
    { value: 'arrest_made',      label: 'Arrest Made' },
    { value: 'case_solved',      label: 'Case Solved' },
    { value: 'case_dismissed',   label: 'Case Dismissed' },
    { value: 'referred_to_court',label: 'Referred to Court' },
]

const ApproveModal = ({ open, onClose, onConfirm, item }) => {
    const [closureReason, setClosureReason] = useState('resolved')
    const [closureCategory, setClosureCategory] = useState('')
    const [investigationSummary, setInvestigationSummary] = useState('')
    const [finalRemarks, setFinalRemarks] = useState('')
    const [firNumber, setFirNumber] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            setClosureReason('resolved')
            setClosureCategory('')
            setInvestigationSummary('')
            setFinalRemarks('')
            setFirNumber('')
        }
    }, [open])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!investigationSummary.trim() || !finalRemarks.trim()) return
        setLoading(true)
        await onConfirm(item, {
            closureReason,
            closureCategory: closureCategory || null,
            investigationSummary: investigationSummary.trim(),
            finalRemarks: finalRemarks.trim(),
            firNumber: firNumber.trim() || null,
        })
        setLoading(false)
    }

    if (!open || !item) return null
    const r = item.report || {}

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md shadow-2xl overflow-y-auto max-h-[90vh]">
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-xl font-semibold text-white">Approve Closure</h3>
                            <p className="text-xs text-white/60 mt-1">Case #{r.case_number || r.id} — fill in the closure report</p>
                        </div>
                        <button type="button" className="btn btn-muted btn-sm" onClick={onClose}>Cancel</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-white/60">CLOSURE REASON <span className="text-red-400">*</span></label>
                            <select className="input-base mt-1" value={closureReason} onChange={e => setClosureReason(e.target.value)} required>
                                {CLOSURE_REASON_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-white/60">CLOSURE CATEGORY <span className="text-white/40">(optional)</span></label>
                            <select className="input-base mt-1" value={closureCategory} onChange={e => setClosureCategory(e.target.value)}>
                                {CLOSURE_CATEGORY_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs text-white/60">INVESTIGATION SUMMARY <span className="text-red-400">*</span></label>
                            <textarea
                                className="input-base mt-1 min-h-[80px]"
                                value={investigationSummary}
                                onChange={e => setInvestigationSummary(e.target.value)}
                                placeholder="Describe what was investigated and what was found..."
                                required
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs text-white/60">FINAL REMARKS <span className="text-red-400">*</span></label>
                            <textarea
                                className="input-base mt-1 min-h-[60px]"
                                value={finalRemarks}
                                onChange={e => setFinalRemarks(e.target.value)}
                                placeholder="Final remarks from Station Admin..."
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs text-white/60">FIR NUMBER <span className="text-white/40">(optional)</span></label>
                            <input
                                className="input-base mt-1"
                                value={firNumber}
                                onChange={e => setFirNumber(e.target.value)}
                                placeholder="e.g., FIR-2025-001"
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-2">
                        <button type="button" className="btn" onClick={onClose} disabled={loading}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Approving...' : 'Approve & Close Case'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ── Main Page ────────────────────────────────────────────────────────────────
const ReceivedRequests = () => {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [requests, setRequests] = useState([])
    const [actionLoading, setActionLoading] = useState(null) // assignment id being actioned
    const [selectedItem, setSelectedItem] = useState(null)
    const [showDetail, setShowDetail] = useState(false)
    const [showApprove, setShowApprove] = useState(false)
    const [approveItem, setApproveItem] = useState(null)

    const getStationId = () => {
        try {
            const raw = localStorage.getItem('crimex_session')
            const session = raw ? JSON.parse(raw) : null
            return session?.profile?.station_id || null
        } catch { return null }
    }

    // If station_id is missing from session, look it up from station_admins table
    const resolveStationId = async () => {
        const fromSession = getStationId()
        if (fromSession) return fromSession

        try {
            const raw = localStorage.getItem('crimex_session')
            const session = raw ? JSON.parse(raw) : null
            const adminId = session?.profile?.id || null
            if (!adminId) return null

            const { data } = await supabase
                .from('station_admins')
                .select('station_id')
                .eq('id', adminId)
                .maybeSingle()
            return data?.station_id || null
        } catch { return null }
    }

    const fetchRequests = async () => {
        setLoading(true)
        setError('')
        try {
            const stationId = await resolveStationId()

            // Step 1: Get all LEO IDs for this station (reliable source of truth)
            // This bypasses the unreliable case_assignments.station_id (may be NULL)
            let leoIds = []
            if (stationId) {
                const { data: stationLeos, error: leosErr } = await supabase
                    .from('law_enforcement_officers')
                    .select('id')
                    .eq('station_id', stationId)
                if (leosErr) throw leosErr
                leoIds = (stationLeos || []).map(l => l.id)
            }

            // If no LEOs found for this station, nothing to show
            if (stationId && leoIds.length === 0) {
                setRequests([])
                setLoading(false)
                return
            }

            // Step 2: Fetch pending_closure assignments filtered by those LEO IDs
            let query = supabase
                .from('case_assignments')
                .select(`
                    id,
                    report_id,
                    leo_id,
                    station_id,
                    status,
                    assigned_at,
                    updated_at,
                    assignment_notes,
                    crime_reports:crime_reports!case_assignments_report_id_fkey (
                        id, case_number, category, description, status, created_at, user_id
                    ),
                    law_enforcement_officers:law_enforcement_officers!case_assignments_leo_id_fkey (
                        id, full_name, badge_number, station_id
                    )
                `)
                .eq('status', 'pending_closure')
                .order('updated_at', { ascending: false })

            if (leoIds.length > 0) {
                query = query.in('leo_id', leoIds)
            }

            const { data: assignments, error: asgErr } = await query
            if (asgErr) throw asgErr

            let rows = assignments || []

            // Collect user IDs to fetch citizen CNICs
            const userIds = rows
                .map(r => r.crime_reports?.user_id)
                .filter(Boolean)

            let cnicMap = new Map()
            if (userIds.length > 0) {
                const { data: users } = await supabase
                    .from('users')
                    .select('id, cnic')
                    .in('id', [...new Set(userIds)])
                for (const u of (users || [])) {
                    cnicMap.set(u.id, u.cnic || '—')
                }
            }

            const enriched = rows.map(row => ({
                ...row,
                report: row.crime_reports || {},
                leo: row.law_enforcement_officers || {},
                citizen: {
                    cnic: cnicMap.get(row.crime_reports?.user_id) || '—',
                },
            }))

            setRequests(enriched)
        } catch (e) {
            setError(e?.message || 'Failed to load requests')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchRequests() }, [])

    const getAdminId = () => {
        try {
            const raw = localStorage.getItem('crimex_session')
            const session = raw ? JSON.parse(raw) : null
            return session?.profile?.id || null
        } catch { return null }
    }

    const openApproveModal = (item) => {
        setApproveItem(item)
        setShowApprove(true)
    }

    const onApprove = async (item, closureData) => {
        setShowApprove(false)
        setActionLoading(item.id)
        try {
            const now = new Date().toISOString()
            const adminId = getAdminId()

            // Compute actual_hours from assigned_at → now
            let actualHours = null
            if (item.assigned_at) {
                const diffMs = new Date(now) - new Date(item.assigned_at)
                actualHours = Math.round((diffMs / 3600000) * 10) / 10 // rounded to 1 decimal
            }

            // Update assignment status → closed
            const { error: asgErr } = await supabase
                .from('case_assignments')
                .update({ status: 'closed', completed_at: now, updated_at: now, actual_hours: actualHours })
                .eq('id', item.id)
            if (asgErr) throw asgErr

            // Update crime_report status → closed
            const { error: repErr } = await supabase
                .from('crime_reports')
                .update({ status: 'closed', updated_at: now })
                .eq('id', item.report_id)
            if (repErr) throw repErr

            // Save closure report
            // closed_by = LEO who handled the case (FK → law_enforcement_officers)
            // approved_by = Station Admin who approved (FK → station_admins)
            const { error: ccrErr } = await supabase.from('case_closure_reports').insert({
                report_id:              item.report_id,
                closed_by:              item.leo_id,
                approved_by:            adminId,
                closure_reason:         closureData.closureReason,
                closure_category:       closureData.closureCategory,
                investigation_summary:  closureData.investigationSummary,
                final_remarks:          closureData.finalRemarks,
                fir_number:             closureData.firNumber,
                closed_at:              now,
                approved_at:            now,
                created_at:             now,
            })
            if (ccrErr) throw ccrErr

            // Log case_update
            try {
                await supabase.from('case_updates').insert({
                    report_id: item.report_id,
                    old_status: 'pending_closure',
                    new_status: 'closed',
                    notes: `Closure approved by Station Admin. Reason: ${closureData.closureReason}.`,
                    created_at: now,
                })
            } catch (_) { }

            // Remove from local list
            setRequests(prev => prev.filter(r => r.id !== item.id))
        } catch (e) {
            setError(e?.message || 'Failed to approve request')
        } finally {
            setActionLoading(null)
        }
    }

    const onReject = async (item) => {
        setActionLoading(item.id)
        try {
            const now = new Date().toISOString()

            // Update assignment status → in_progress
            const { error: asgErr } = await supabase
                .from('case_assignments')
                .update({ status: 'in_progress', updated_at: now, assignment_notes: null })
                .eq('id', item.id)
            if (asgErr) throw asgErr

            // Keep crime_report status as in_progress
            const { error: repErr } = await supabase
                .from('crime_reports')
                .update({ status: 'in_progress', updated_at: now })
                .eq('id', item.report_id)
            if (repErr) throw repErr

            // Log case_update
            try {
                await supabase.from('case_updates').insert({
                    report_id: item.report_id,
                    old_status: 'pending_closure',
                    new_status: 'in_progress',
                    notes: 'Closure request rejected by Station Admin. Case remains in progress.',
                    created_at: now,
                })
            } catch (_) { }

            // Remove from local list
            setRequests(prev => prev.filter(r => r.id !== item.id))
        } catch (e) {
            setError(e?.message || 'Failed to reject request')
        } finally {
            setActionLoading(null)
        }
    }

    const openDetail = (item) => {
        setSelectedItem(item)
        setShowDetail(true)
    }

    return (
        <Layout>
            <div className="card p-6 mb-6">
                <h1 className="text-xl font-display font-semibold">Received Closure Requests</h1>
                <p className="text-xs text-base-muted mt-1">
                    Cases where LEO has requested closure — review and approve or reject.
                </p>
            </div>

            {error && (
                <div className="card p-4 mb-6 text-sm text-semantic-danger border border-semantic-danger/40 bg-semantic-danger/10">
                    {error}
                </div>
            )}

            {loading ? (
                <p className="text-base-muted">Loading...</p>
            ) : requests.length === 0 ? (
                <div className="card p-8 text-center text-base-muted">
                    No pending closure requests at this time.
                </div>
            ) : (
                <div className="table-wrapper">
                    <table className="data-grid">
                        <thead>
                            <tr>
                                <th>Case #</th>
                                <th>Title</th>
                                <th>Officer</th>
                                <th>Requested At</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map(item => {
                                const busy = actionLoading === item.id
                                return (
                                    <tr key={item.id}>
                                        <td className="font-mono text-xs">
                                            #{item.report?.case_number || item.report_id}
                                        </td>
                                        <td>{item.report?.category || '—'}</td>
                                        <td>
                                            {item.leo?.full_name || '—'}
                                            {item.leo?.badge_number ? (
                                                <span className="text-xs text-base-muted ml-1">
                                                    #{item.leo.badge_number}
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className="text-xs">{formatDateTimePretty(item.updated_at)}</td>
                                        <td>
                                            <StatusChip status="pending_closure" />
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                {/* View Report */}
                                                <button
                                                    className="btn btn-secondary btn-sm flex items-center gap-1"
                                                    onClick={() => openDetail(item)}
                                                    title="View Report"
                                                >
                                                    <EyeIcon className="h-4 w-4" />
                                                    <span>View Report</span>
                                                </button>

                                                {/* Approve */}
                                                <button
                                                    className="btn btn-primary btn-sm flex items-center gap-1"
                                                    onClick={() => onApprove(item)}
                                                    disabled={busy}
                                                    title="Approve Closure"
                                                >
                                                    <CheckCircleIcon className="h-4 w-4" />
                                                    <span>{busy ? '...' : 'Approve'}</span>
                                                </button>

                                                {/* Reject */}
                                                <button
                                                    className="btn btn-danger btn-sm flex items-center gap-1"
                                                    onClick={() => onReject(item)}
                                                    disabled={busy}
                                                    title="Reject Closure"
                                                >
                                                    <XCircleIcon className="h-4 w-4" />
                                                    <span>{busy ? '...' : 'Reject'}</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <DetailModal
                open={showDetail}
                onClose={() => setShowDetail(false)}
                item={selectedItem}
            />
            <ApproveModal
                open={showApprove}
                onClose={() => setShowApprove(false)}
                onConfirm={onApprove}
                item={approveItem}
            />
        </Layout>
    )
}

export default ReceivedRequests
