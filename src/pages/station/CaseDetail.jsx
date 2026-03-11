import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import StatusChip from '../../components/StatusChip'
import {
    CheckCircleIcon,
    ClipboardDocumentListIcon,
    ArrowPathIcon,
    PlayIcon,
    XCircleIcon,
} from '@heroicons/react/24/solid'
import { supabase } from '../../lib/supabase.js'

function formatDateTimePretty(dt) {
    try { return new Date(dt).toLocaleString() } catch { return dt || '-' }
}

const StationCaseDetail = () => {
    // Route is /station/case/:id, so read 'id' here
    const { id } = useParams()
    const reportId = id

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [report, setReport] = useState(null)
    const [latestAssignment, setLatestAssignment] = useState(null)
    const [timeline, setTimeline] = useState([])

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            setError('')
            try {
                const { data, error: err } = await supabase
                    .from('crime_reports')
                    .select(`
            id,
            case_number,
            category,
            description,
            status,
            priority,
            incident_date,
            created_at,
            updated_at,
            user_id,
            assigned_station_id,
            assigned_to,
            location_address,
            latitude,
            longitude,
            province,
            users:users!crime_reports_user_id_fkey ( id, full_name, cnic ),
            case_assignments:case_assignments!case_assignments_report_id_fkey (
              id, status, assigned_at, updated_at, leo_id,
              law_enforcement_officers:law_enforcement_officers!case_assignments_leo_id_fkey (
                id, full_name, badge_number, rank
              )
            )
          `)
                    .eq('id', reportId)
                    .maybeSingle()

                if (err) throw err
                if (!data) throw new Error('Case not found')

                setReport({
                    id: data.id,
                    caseNumber: data.case_number || data.id,
                    title: data.category,
                    description: data.description,
                    status: data.status,
                    priority: data.priority,
                    incidentDate: data.incident_date,
                    createdAt: data.created_at,
                    updatedAt: data.updated_at,
                    citizenName: data.users?.full_name || 'N/A',
                    citizenCnic: data.users?.cnic || 'N/A',
                    address: data.location_address,
                    lat: data.latitude,
                    lon: data.longitude,
                    province: data.province,
                    assignedStationId: data.assigned_station_id,
                })

                const assignments = Array.isArray(data.case_assignments)
                    ? data.case_assignments
                    : data.case_assignments
                        ? [data.case_assignments]
                        : []
                const latest = assignments.sort((a, b) => {
                    const at = new Date(a.assigned_at || a.updated_at || 0).getTime()
                    const bt = new Date(b.assigned_at || b.updated_at || 0).getTime()
                    return bt - at
                })[0]
                setLatestAssignment(latest || null)

                const { data: updates, error: updatesErr } = await supabase
                    .from('case_updates')
                    .select('id, created_at, old_status, new_status, notes')
                    .eq('report_id', reportId)
                    .order('created_at', { ascending: true })
                if (updatesErr) throw updatesErr
                setTimeline(updates || [])
            } catch (e) {
                setError(e?.message || 'Failed to load case')
                setReport(null)
                setLatestAssignment(null)
                setTimeline([])
            } finally {
                setLoading(false)
            }
        }
        if (reportId) load()
    }, [reportId])

    return (
        <Layout>
            <div className="card p-6 mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-display font-semibold">Case #{report?.caseNumber || reportId}</h1>
                        <p className="text-xs text-base-muted mt-1">Detailed case information.</p>
                    </div>
                    <Link to="/station/assign" className="btn">Back</Link>
                </div>
            </div>

            {error && (
                <div className="card p-4 mb-6 text-sm text-semantic-danger border border-semantic-danger/40 bg-semantic-danger/10">
                    {error}
                </div>
            )}

            {loading ? (
                <p className="text-base-muted">Loading...</p>
            ) : report ? (
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="card p-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">{report.title}</h2>
                            <StatusChip status={(report.status || 'NEW').toUpperCase()} />
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                            <div>
                                <p className="text-base-muted">Citizen CNIC</p>
                                <p className="font-medium">{report.citizenCnic}</p>
                            </div>
                            <div>
                                <p className="text-base-muted">Last Updated</p>
                                <p className="font-medium">{formatDateTimePretty(report.updatedAt)}</p>
                            </div>
                            <div>
                                <p className="text-base-muted">Assigned Officer</p>
                                <p className="font-medium">
                                    {latestAssignment?.law_enforcement_officers
                                        ? `${latestAssignment.law_enforcement_officers.full_name} (Badge ${latestAssignment.law_enforcement_officers.badge_number})`
                                        : 'Unassigned'}
                                </p>
                            </div>
                            <div>
                                <p className="text-base-muted">Priority</p>
                                <p className="font-medium">{report.priority || 'N/A'}</p>
                            </div>
                        </div>

                        <div className="mt-6">
                            <p className="text-base-muted text-xs">Internal Notes</p>
                            <div className="mt-2 p-3 rounded-lg border border-base-200 bg-base-50 text-sm">
                                {report.description || 'No notes yet.'}
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-base-muted">Incident Date</p>
                                <p className="font-medium">{formatDateTimePretty(report.incidentDate)}</p>
                            </div>
                            <div>
                                <p className="text-base-muted">Address</p>
                                <p className="font-medium">{report.address || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card p-6">
                        <h2 className="text-lg font-semibold">Workflow Snapshot</h2>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {['new', 'triaged', 'assigned', 'in_progress', 'closed'].map(s => (
                                <StatusChip key={s} status={s.toUpperCase()} />
                            ))}
                        </div>

                        <div className="mt-6">
                            <h3 className="text-sm font-semibold">Timeline</h3>
                            <div className="mt-4 timeline">
                                {timeline.length === 0 ? (
                                    <p className="text-xs text-base-muted">No history yet.</p>
                                ) : (
                                    timeline.map((ev, idx) => {
                                        const status = (ev.new_status || '').toLowerCase()
                                        let Icon = ClipboardDocumentListIcon
                                        let tone = 'timeline-dot--muted'
                                        if (status === 'new' || status === 'triaged') { Icon = ClipboardDocumentListIcon; tone = 'timeline-dot--info' }
                                        if (status === 'assigned') { Icon = ArrowPathIcon; tone = 'timeline-dot--accent' }
                                        if (status === 'in_progress') { Icon = PlayIcon; tone = 'timeline-dot--warning' }
                                        if (status === 'closed') { Icon = CheckCircleIcon; tone = 'timeline-dot--success' }

                                        return (
                                            <div key={ev.id} className="timeline-item">
                                                <div className={`timeline-dot ${tone}`}> 
                                                    <Icon className="h-4 w-4 timeline-icon" />
                                                </div>
                                                <div className="timeline-body">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-sm font-medium">{ev.new_status?.replace('_',' ')?.toUpperCase()}</div>
                                                        <div className="text-xs text-base-muted">{formatDateTimePretty(ev.created_at)}</div>
                                                    </div>
                                                    {ev.notes && <div className="text-sm mt-2 text-base-text">{ev.notes}</div>}
                                                    <div className="mt-2 text-xs text-base-muted">{ev.old_status ? `${ev.old_status} → ${ev.new_status}` : ev.new_status}</div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <p className="text-base-muted">Case not found</p>
            )}
        </Layout>
    )
}

export default StationCaseDetail