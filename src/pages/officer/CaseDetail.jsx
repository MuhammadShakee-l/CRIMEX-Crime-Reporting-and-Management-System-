import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import StatusChip from '../../components/StatusChip'
import { formatDateTimePretty } from '../../utils/format'
import { loadCaseDetail, markCaseInProgress, requestClosure } from '../../services/leoService'

const ClosureRequestModal = ({ open, onCancel, onConfirm }) => {
    const [reason, setReason] = useState('Resolved')
    const [remarks, setRemarks] = useState('')

    useEffect(() => {
        if (open) {
            setReason('Resolved')
            setRemarks('')
        }
    }, [open])

    if (!open) return null
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md shadow-2xl">
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-1 text-white">Send Closure Request</h3>
                    <p className="text-xs text-white/60 mb-4">Your request will be sent to the Station Admin for approval.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <div className="text-xs text-white/70 mb-1">CLOSURE REASON</div>
                            <select
                                className="w-full rounded-xl border border-base-300 bg-white text-black p-2 outline-none"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            >
                                <option className="bg-white text-black" value="Resolved">Resolved</option>
                                <option className="bg-white text-black" value="Insufficient Evidence">Insufficient Evidence</option>
                                <option className="bg-white text-black" value="False Report">False Report</option>
                                <option className="bg-white text-black" value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <div className="text-xs text-white/70 mb-1">LEO REMARKS</div>
                            <textarea
                                className="w-full rounded-xl border border-base-300 bg-white text-black p-2 outline-none placeholder-slate-400 resize-none"
                                placeholder="Summary of findings / outcome"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                rows={2}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button className="btn btn-muted" onClick={onCancel}>Cancel</button>
                        <button className="btn btn-warning" onClick={() => onConfirm({ reason, remarks })}>
                            Send Request
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

const DetailedInfoModal = ({ open, onClose, report, citizen }) => {
    if (!open) return null

    const location = {
        province: report?.province || report?.state || '—',
        city: report?.city || report?.town || '—',
        capturedAt: report?.captured_at || report?.created_at || null,
        coords: report?.lat && report?.lng ? `${report.lat}, ${report.lng}` : null,
        accuracy: report?.accuracy ? ` (±${report.accuracy}m)` : '',
    }

    const attachments = [
        ...(report?.image_url ? [{ type: 'IMAGE', name: (report.image_name || 'scene.jpg'), url: report.image_url, uploaded_at: report.image_uploaded_at }] : []),
        ...(report?.audio_url ? [{ type: 'AUDIO', name: (report.audio_name || 'witness.m4a'), url: report.audio_url, uploaded_at: report.audio_uploaded_at }] : []),
        ...(Array.isArray(report?.attachments) ? report.attachments : []),
    ]

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full max-w-5xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md shadow-2xl">
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-semibold text-white">Detailed Information</h3>
                        <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
                    </div>

                    <div className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-5">
                        <div className="text-xs text-white/70">FULL DESCRIPTION</div>
                        <div className="mt-2 text-white">
                            {report?.description || report?.details || '—'}
                        </div>
                    </div>

                    {attachments.length > 0 && (
                        <div className="mt-6">
                            <div className="text-xs text-white/70 mb-2">ATTACHMENTS</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {attachments.map((att, idx) => (
                                    <div key={idx} className="rounded-2xl border border-white/15 bg-white/5 p-4">
                                        <div className="text-xs text-white/60">{att.type}</div>
                                        <div className="text-white font-medium">{att.name || 'attachment'}</div>
                                        {att.uploaded_at && (
                                            <div className="text-xs text-white/50 mt-1">
                                                Uploaded: {formatDateTimePretty(att.uploaded_at)}
                                            </div>
                                        )}
                                        {att.url && (
                                            <div className="mt-3">
                                                <a
                                                    href={att.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="btn btn-secondary btn-sm"
                                                >
                                                    Open
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-5">
                        <div className="text-xs text-white/70 mb-2">LOCATION</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-white">
                            <div>
                                <div>Province: <span className="font-medium">{location.province}</span></div>
                                <div>City: <span className="font-medium">{location.city}</span></div>
                                {location.coords && (
                                    <div className="text-sm mt-2">Coords: {location.coords}{location.accuracy}</div>
                                )}
                            </div>
                            <div>
                                <div>
                                    Captured: <span className="font-medium">
                                        {location.capturedAt ? formatDateTimePretty(location.capturedAt) : '—'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-white">
                        <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
                            <div className="text-xs text-white/70">CASE TITLE</div>
                            <div className="font-medium">{report?.category || '—'}</div>
                            <div className="mt-3 text-xs text-white/70">REPORTED AT</div>
                            <div className="font-medium">
                                {report?.created_at ? formatDateTimePretty(report.created_at) : '—'}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
                            <div className="text-xs text-white/70">CITIZEN CNIC</div>
                            <div className="font-medium">{citizen?.cnic || '—'}</div>
                            <div className="mt-3 text-xs text-white/70">UPDATED AT</div>
                            <div className="font-medium">
                                {report?.updated_at ? formatDateTimePretty(report.updated_at) : '—'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const CaseDetail = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [data, setData] = useState(null)

    const [showCloseModal, setShowCloseModal] = useState(false)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [showClosureReport, setShowClosureReport] = useState(false)
    const [requestSent, setRequestSent] = useState(false)

    const formatClosureReason = (reason) => {
        if (!reason) return '—'
        const normalized = reason.replace(/_/g, ' ').toLowerCase()
        return normalized.charAt(0).toUpperCase() + normalized.slice(1)
    }

    const extractReasonFromNotes = (notes) => {
        if (!notes) return ''
        const match = notes.match(/Reason:\s*([^|]+)/i)
        return match ? match[1].trim() : ''
    }

    const extractRemarksFromNotes = (notes) => {
        if (!notes) return ''
        const match = notes.match(/Remarks:\s*(.*)/i)
        return match ? match[1].trim() : ''
    }

    useEffect(() => {
        let mounted = true
        const load = async () => {
            setLoading(true)
            setError('')
            try {
                const d = await loadCaseDetail(id)
                if (mounted) {
                    setData(d)
                }
            } catch (e) {
                if (mounted) setError(e?.message || 'Unauthorized')
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [id])

    const onMarkInProgress = async () => {
        try {
            setLoading(true)
            const updated = await markCaseInProgress(id)
            setData(prev => ({ ...prev, assignment: updated }))
        } catch (e) {
            setError(e?.message || 'Failed to update status')
        } finally {
            setLoading(false)
        }
    }

    const onConfirmClose = async ({ reason, remarks }) => {
        try {
            setLoading(true)
            const updated = await requestClosure(id, { reason, remarks })
            setData(prev => ({ ...prev, assignment: { ...(prev?.assignment || {}), ...updated, status: 'pending_closure' } }))
            setShowCloseModal(false)
            setRequestSent(true)
        } catch (e) {
            setError(e?.message || 'Failed to send closure request')
        } finally {
            setLoading(false)
        }
    }

    const title = data?.report?.category || '—'
    const caseNo = data?.report?.case_number || '—'
    const citizenCnic = data?.citizen?.cnic || '—'
    const reportedAt = data?.report?.created_at || data?.report?.updated_at
    const assignedAt = data?.assignment?.assigned_at
    const status = data?.assignment?.status || 'assigned'
    const deadlineRaw = data?.assignment?.deadline || null
    const deadlineFormatted = deadlineRaw
        ? new Date(deadlineRaw).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : '—'
    const isOverdue = deadlineRaw && status !== 'closed' && new Date(deadlineRaw) < new Date()
    const actualHours = data?.assignment?.actual_hours ?? null
    const closure = data?.closure || null

    const closedAt = closure?.closed_at || data?.assignment?.completed_at || data?.assignment?.closed_at || null
    const closureReason = formatClosureReason(
        closure?.closure_reason ||
        data?.assignment?.closure_reason ||
        extractReasonFromNotes(data?.assignment?.assignment_notes)
    )
    const finalRemarks = closure?.final_remarks ||
        data?.assignment?.final_remarks ||
        extractRemarksFromNotes(data?.assignment?.assignment_notes) ||
        '—'
    const officerName = data?.officer?.full_name || '—'

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
                <>
                    <div className="card p-6 mb-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-2xl font-display font-semibold">Case #{caseNo}</h1>
                                <p className="text-sm text-base-muted">Quick summary and actions.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <StatusChip status={status} />
                                <button
                                    className="btn btn-muted"
                                    onClick={() => setShowDetailModal(true)}
                                    title="View Detailed Info"
                                >
                                    View Detailed Info
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                            <div>
                                <div className="text-xs text-base-muted">CASE TITLE</div>
                                <div className="font-medium">{title}</div>
                            </div>
                            <div>
                                <div className="text-xs text-base-muted">CITIZEN CNIC</div>
                                <div className="font-medium">{citizenCnic}</div>
                            </div>
                            <div>
                                <div className="text-xs text-base-muted">REPORTED AT</div>
                                <div className="font-medium">{formatDateTimePretty(reportedAt)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-base-muted">ASSIGNED AT</div>
                                <div className="font-medium">{formatDateTimePretty(assignedAt)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-base-muted">DEADLINE</div>
                                <div className={`font-medium ${isOverdue ? 'text-red-400' : ''}`}>
                                    {deadlineFormatted}
                                    {isOverdue && <span className="ml-2 text-xs font-normal">⚠ Overdue</span>}
                                </div>
                            </div>
                            {actualHours !== null && (
                                <div>
                                    <div className="text-xs text-base-muted">ACTUAL HOURS</div>
                                    <div className="font-medium">{actualHours} hrs</div>
                                </div>
                            )}
                        </div>

                        <div className="mt-6">
                            <button className="btn btn-secondary mr-3" onClick={() => navigate(-1)}>Back</button>
                            {status !== 'closed' && (
                                <>
                                    <button className="btn btn-warning mr-3" onClick={onMarkInProgress} disabled={status === 'in_progress' || status === 'pending_closure'}>
                                        Mark In Progress
                                    </button>
                                    <button
                                        className="btn btn-danger"
                                        onClick={() => setShowCloseModal(true)}
                                        disabled={status === 'pending_closure' || status === 'assigned'}
                                        title={status === 'pending_closure' ? 'Closure request already sent' : status === 'assigned' ? 'First mark as In Progress' : ''}
                                    >
                                        Request Closure
                                    </button>
                                </>
                            )}
                        </div>

                        {status === 'pending_closure' && (
                            <div className="mt-4 p-3 rounded-xl border border-orange-500/40 bg-orange-500/10 text-sm text-orange-300">
                                ⏳ Closure request sent to Station Admin — awaiting approval.
                            </div>
                        )}

                        {requestSent && status === 'pending_closure' && (
                            <div className="mt-3 p-3 rounded-xl border border-greenbrand-primary/40 bg-greenbrand-primary/10 text-sm text-greenbrand-light">
                                ✓ Closure request submitted successfully. Station Admin will review it.
                            </div>
                        )}
                    </div>

                    {/* Internal Notes section REMOVED per request */}

                    {status === 'closed' && (
                        <div className="card p-6 mt-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold">Closure Report</h2>
                                <button
                                    className="btn btn-muted"
                                    onClick={() => setShowClosureReport(v => !v)}
                                >
                                    {showClosureReport ? 'Hide Closure Report' : 'View Closure Report'}
                                </button>
                            </div>

                            {showClosureReport && (
                                <div className="mt-4 rounded-2xl border border-base-300/30 bg-base-100/20 p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
                                        <div>
                                            <div className="text-xs text-base-muted">CASE ID</div>
                                            <div className="font-medium">{caseNo}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-base-muted">CASE TITLE</div>
                                            <div className="font-medium">{title}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-base-muted">CITIZEN CNIC</div>
                                            <div className="font-medium">{citizenCnic}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-base-muted">ASSIGNED OFFICER</div>
                                            <div className="font-medium">{officerName}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-base-muted">REPORTED AT</div>
                                            <div className="font-medium">{formatDateTimePretty(reportedAt)}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-base-muted">ASSIGNED AT</div>
                                            <div className="font-medium">{assignedAt ? formatDateTimePretty(assignedAt) : '—'}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-base-muted">CLOSED AT</div>
                                            <div className="font-medium">{closedAt ? formatDateTimePretty(closedAt) : '—'}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-base-muted">CLOSURE REASON</div>
                                            <div className="font-medium">{closureReason}</div>
                                        </div>
                                        <div className="md:col-span-2">
                                            <div className="text-xs text-base-muted">FINAL REMARKS</div>
                                            <div className="font-medium">{finalRemarks || '—'}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <ClosureRequestModal
                        open={showCloseModal}
                        onCancel={() => setShowCloseModal(false)}
                        onConfirm={onConfirmClose}
                    />

                    <DetailedInfoModal
                        open={showDetailModal}
                        onClose={() => setShowDetailModal(false)}
                        report={data?.report}
                        citizen={data?.citizen}
                    />
                </>
            )}
        </Layout>
    )
}

export default CaseDetail