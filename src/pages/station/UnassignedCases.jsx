import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import { toast } from 'react-toastify'
import StatusChip from '../../components/StatusChip'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { getCurrentStationAdmin } from '../../services/adminService.js'
import { getLeoRosterAll } from '../../services/leoService.js'
import { assignCase } from '../../services/casesService.js'

const UnassignedCases = () => {
    const [loading, setLoading] = useState(true)
    const [items, setItems] = useState([])
    const [error, setError] = useState('')

    const [modalOpen, setModalOpen] = useState(false)
    const [selectedCase, setSelectedCase] = useState(null)

    const [admin, setAdmin] = useState(null)
    const [leos, setLeos] = useState([])
    const [search, setSearch] = useState('')
    const [selectedLeoId, setSelectedLeoId] = useState('')
    const [assigning, setAssigning] = useState(false)

    const [deadline, setDeadline] = useState('')
    const [deadlineError, setDeadlineError] = useState('')
    const [justAssigned, setJustAssigned] = useState(null)
    const navigate = useNavigate()

    const todayStr = new Date().toISOString().split('T')[0] // yyyy-mm-dd for min attr

    const filteredLeos = useMemo(() => {
        const t = search.trim().toLowerCase()
        if (!t) return leos
        return leos.filter(l =>
            String(l.badge_number || '').toLowerCase().includes(t) ||
            String(l.full_name || '').toLowerCase().includes(t)
        )
    }, [search, leos])

    const loadCases = async () => {
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
          updated_at,
          user_id,
          users!crime_reports_user_id_fkey ( cnic, full_name )
        `)
                .eq('status', 'new')
                .order('updated_at', { ascending: false })
            if (err) throw err

            const mapped = (data || []).map(r => ({
                id: r.case_number || r.id,
                caseNumber: r.case_number || r.id,
                title: r.category,
                citizenCnic: r.users?.cnic || 'N/A',
                citizenName: r.users?.full_name || 'N/A',
                updatedAt: r.updated_at,
                status: r.status,
                priority: r.priority,
                description: r.description,
                reportId: r.id,
            }))
            setItems(mapped)
        } catch (e) {
            setError(e?.message || 'Failed to load unassigned cases')
            toast.error(e?.message || 'Failed to load unassigned cases')
            setItems([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadCases() }, [])

    const openAssignModal = async (c) => {
        try {
            setSelectedCase(c)
            const a = await getCurrentStationAdmin()
            if (!a) { toast.error('Station admin not found'); return }
            setAdmin(a)

            // Load entire roster (no station filter) to keep dropdown populated like before
            const roster = await getLeoRosterAll()
            const normalized = (roster || []).map(r => ({
                id: r.id,
                full_name: r.full_name || '—',
                badge_number: r.badge_number || '—',
                workload: Number.isFinite(r.workload) ? r.workload : 0,
                user_id: r.user_id ?? null, // may be null; assignCase will auto-link
            }))
            setLeos(normalized)
            setSearch('')
            setSelectedLeoId('')
            setDeadline('')
            setDeadlineError('')
            setModalOpen(true)
        } catch (e) {
            toast.error(e?.message || 'Unable to open assignment dialog')
        }
    }

    const closeAssignModal = () => {
        setModalOpen(false)
        setSelectedCase(null)
        setSelectedLeoId('')
        setSearch('')
        setDeadline('')
        setDeadlineError('')
    }

    const onDeadlineChange = (val) => {
        setDeadline(val)
        if (val && val < todayStr) {
            setDeadlineError('Invalid date — deadline cannot be in the past.')
        } else {
            setDeadlineError('')
        }
    }

    const onAssign = async () => {
        if (!selectedCase || !selectedLeoId || !admin) {
            toast.error('Select a case and an investigator')
            return
        }
        if (deadline && deadline < todayStr) {
            setDeadlineError('Invalid date — deadline cannot be in the past.')
            return
        }
        setAssigning(true)
        try {
            const result = await assignCase({
                report_id: selectedCase.reportId,
                leo_id: selectedLeoId,
                station_id: admin.station_id,
                assigned_by_station_admin_id: admin.id,
                deadline: deadline ? new Date(deadline).toISOString() : null,
            })

            toast.success('Case assigned')

            // Remove from unassigned list
            setItems(prev => prev.filter(x => x.reportId !== selectedCase.reportId))

            // Show preview card using case_number as ID (like your screenshot)
            setJustAssigned({
                case_number: result.report.case_number,
                investigatorLabel: result.investigator.label,
                updated_at: result.report.updated_at,
                title: result.report.category || selectedCase.title || 'CASE',
            })

            closeAssignModal()
            // If you prefer to jump to Assigned page instead of preview:
            // navigate('/station/assigned')
        } catch (e) {
            // Always show the real error so we can see constraints/RLS if any
            toast.error(e?.message || 'Failed to assign case')
            console.error('[assignCase] failed:', e)
        } finally {
            setAssigning(false)
        }
    }

    const leoOptionLabel = (leo) => `${leo.full_name} (Badge ${leo.badge_number}) - Open ${leo.workload}`

    return (
        <Layout>
            <div className="card p-6 mb-6">
                <h1 className="text-xl font-display font-semibold">Unassigned Cases</h1>
                <p className="text-sm text-base-muted mt-1">Review incoming cases and allocate to LEOs based on current workload.</p>
            </div>

            {justAssigned && (
                <div className="card p-5 mb-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">{justAssigned.title}</h3>
                        <StatusChip status="ASSIGNED" />
                    </div>
                    <p className="text-xs text-base-muted mt-2">ID: {justAssigned.case_number}</p>
                    <p className="text-xs text-base-muted">Investigator: {justAssigned.investigatorLabel}</p>
                    <p className="text-xs text-base-muted">Updated: {new Date(justAssigned.updated_at).toLocaleString()}</p>
                    <div className="mt-3">
                        <button className="btn" onClick={() => navigate('/station/assigned')}>Open</button>
                    </div>
                </div>
            )}

            {error && (
                <div className="card p-4 mb-6 text-sm text-semantic-danger border border-semantic-danger/40 bg-semantic-danger/10">
                    {error}
                </div>
            )}

            {loading ? (
                <p className="text-base-muted">Loading...</p>
            ) : (
                <div className="grid md:grid-cols-2 gap-4">
                    {items.map(c => (
                        <div key={c.id} className="card p-5 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold">{c.title}</h3>
                                <StatusChip status="NEW" />
                            </div>
                            <p className="text-xs text-base-muted">ID: {c.caseNumber}</p>
                            <p className="text-xs text-base-muted">Citizen CNIC: {c.citizenCnic}</p>
                            <div className="mt-3 flex gap-2">
                                <button className="btn btn-primary" onClick={() => openAssignModal(c)}>Assign</button>
                                <button className="btn" onClick={() => navigate(`/station/case/${c.reportId}`)}>Open</button>
                            </div>
                        </div>
                    ))}
                    {items.length === 0 && !error && (
                        <div className="card p-6 text-center text-sm text-base-muted">No unassigned cases</div>
                    )}
                </div>
            )}

            {modalOpen && selectedCase && (
                <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
                    <div className="card w-full max-w-2xl p-6 relative z-[61]" style={{ overflow: 'visible' }}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold">Assign Case #{selectedCase.caseNumber}</h2>
                            <button className="btn btn-sm" onClick={closeAssignModal}>✕</button>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs text-base-muted mb-1">SEARCH LEO</label>
                            <input
                                className="input-base text-black placeholder:text-black/40"
                                placeholder="Name or badge..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="mb-2 relative z-[62]" style={{ overflow: 'visible' }}>
                            <label className="block text-xs text-base-muted mb-1">SELECT LEO</label>
                            <select
                                value={selectedLeoId}
                                onChange={(e) => setSelectedLeoId(e.target.value)}
                                className="w-full rounded-xl border border-base-300/40 bg-base-100 p-2 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="">Choose Investigator</option>
                                {filteredLeos.length > 0
                                    ? filteredLeos.map(leo => (
                                        <option key={leo.id} value={leo.id}>{leoOptionLabel(leo)}</option>
                                    ))
                                    : <option value="" disabled>No investigators available</option>
                                }
                            </select>
                        </div>

                        <div className="mt-4">
                            <label className="block text-xs text-base-muted mb-1">DEADLINE <span className="text-white/40">(optional)</span></label>
                            <input
                                type="date"
                                className="input-base"
                                min={todayStr}
                                value={deadline}
                                onChange={(e) => onDeadlineChange(e.target.value)}
                            />
                            {deadlineError && (
                                <p className="text-xs text-semantic-danger mt-1">{deadlineError}</p>
                            )}
                        </div>

                        <p className="text-xs text-base-muted mt-3">Choose the best workload match for timely resolution.</p>

                        <div className="mt-6 flex justify-end gap-2">
                            <button className="btn" onClick={closeAssignModal}>Cancel</button>
                            <button className="btn btn-primary" onClick={onAssign} disabled={assigning || !selectedLeoId}>
                                {assigning ? 'Assigning…' : 'Assign'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}

export default UnassignedCases