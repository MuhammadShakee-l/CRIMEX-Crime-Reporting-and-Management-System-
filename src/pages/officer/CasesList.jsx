import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import { useLocation, useNavigate } from 'react-router-dom'
import { EyeIcon } from '@heroicons/react/24/outline'
import StatusChip from '../../components/StatusChip'
import { formatDateTimePretty } from '../../utils/format'
import { loadLeoCases, markCaseInProgress } from '../../services/leoService'

// Helpers
function useQuery() {
    const { search } = useLocation()
    return useMemo(() => new URLSearchParams(search), [search])
}

const OfficerCasesList = () => {
    const query = useQuery()
    const navigate = useNavigate()
    const filter = (query.get('filter') || 'all').toLowerCase() // 'all'|'assigned'|'in_progress'|'pending_closure'|'closed'
    const [loading, setLoading] = useState(true)
    const [cases, setCases] = useState([])
    const [error, setError] = useState('')

    useEffect(() => {
        let mounted = true
        const load = async () => {
            setLoading(true)
            setError('')
            try {
                const list = await loadLeoCases({ status: filter })
                if (mounted) setCases(Array.isArray(list) ? list : [])
            } catch (e) {
                if (mounted) {
                    setError(e?.message || 'Failed to load cases')
                    setCases([])
                }
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [filter])

    const renderId = (r) => r.case_number || '—'    // display case_number
    const renderTitle = (r) => r.title || '—'
    const renderCitizenCnic = (r) => r.citizen_cnic || '—'
    const renderUpdatedAt = (r) => {
        const val = r.updated_at || r.created_at
        return formatDateTimePretty ? formatDateTimePretty(val) : (val ? new Date(val).toLocaleString() : '—')
    }
    const renderStatus = (r) => (r.status || 'assigned').toLowerCase()

    const filtered = useMemo(() => {
        if (filter === 'all') return cases
        return cases.filter(c => renderStatus(c) === filter)
    }, [cases, filter])

    const onStartWork = async (caseId) => {
        try {
            await markCaseInProgress(caseId)
            // After starting work, move to in_progress filter to reflect the folder change
            navigate('/officer/cases?filter=in_progress')
        } catch (e) {
            alert(e?.message || 'Failed to mark case as in progress')
        }
    }

    return (
        <Layout>
            <div className="card p-6 mb-6">
                <h1 className="text-xl font-display font-semibold">My Cases</h1>
                <p className="text-xs text-base-muted mt-1">Filter: {filter}</p>
            </div>

            {error && (
                <div className="card p-4 mb-6 text-sm text-semantic-danger border border-semantic-danger/40 bg-semantic-danger/10">
                    {error}
                </div>
            )}

            {loading ? (
                <p className="text-base-muted">Loading...</p>
            ) : (
                <div className="table-wrapper">
                    <table className="data-grid">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Title</th>
                                <th>Citizen CNIC</th>
                                <th>Status</th>
                                <th>Updated</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(c => (
                                <tr key={c.id}>
                                    <td>{renderId(c)}</td>
                                    <td>{renderTitle(c)}</td>
                                    <td>{renderCitizenCnic(c)}</td>
                                    <td><StatusChip status={renderStatus(c)} /></td>
                                    <td>{renderUpdatedAt(c)}</td>
                                    <td className="flex items-center gap-2">
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => navigate(`/officer/case/${c.id}`)} // crime_reports.id
                                            title="Open"
                                        >
                                            <EyeIcon className="h-4 w-4" />
                                        </button>
                                        {renderStatus(c) === 'assigned' && (
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => onStartWork(c.id)}
                                                title="Start Work"
                                            >
                                                Start
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && !error && (
                                <tr>
                                    <td colSpan={6} className="text-center text-base-muted">No cases</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </Layout>
    )
}

export default OfficerCasesList