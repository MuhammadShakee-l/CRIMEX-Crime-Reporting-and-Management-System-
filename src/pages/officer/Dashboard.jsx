import React, { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import StatCard from '../../components/StatCard'
import { useNavigate } from 'react-router-dom'
import { Squares2X2Icon, ClipboardDocumentCheckIcon, BoltIcon, CheckBadgeIcon, ClockIcon } from '@heroicons/react/24/outline'
import { loadLeoDashboardCounts } from '../../services/leoService'

const OfficerDashboard = () => {
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({ total: 0, assigned: 0, inProgress: 0, pendingClosure: 0, closed: 0 })
    const [error, setError] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        let mounted = true
        const load = async () => {
            setLoading(true)
            setError('')
            try {
                const totals = await loadLeoDashboardCounts()
                if (mounted) setStats(totals)
            } catch (e) {
                if (mounted) setError(e?.message || 'Unauthorized: not signed in')
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [])

    return (
        <Layout>
            <div className="card p-6">
                <h1 className="text-2xl font-display font-semibold">LEO Dashboard</h1>
                <p className="text-sm text-base-muted mt-1">Comprehensive case overview.</p>

                {error && (
                    <div className="mt-4 p-4 rounded-xl border border-semantic-danger/40 bg-semantic-danger/10 text-sm text-semantic-danger">
                        {error}
                    </div>
                )}

                {loading ? (
                    <p className="text-base-muted mt-6">Loading...</p>
                ) : (
                    <div className="stat-grid mt-6">
                        <StatCard
                            icon={Squares2X2Icon}
                            label="Total Cases"
                            value={stats.total}
                            onClick={() => navigate('/officer/cases?filter=all')}
                        />
                        <StatCard
                            icon={ClipboardDocumentCheckIcon}
                            label="Assigned"
                            value={stats.assigned}
                            onClick={() => navigate('/officer/cases?filter=assigned')}
                        />
                        <StatCard
                            icon={BoltIcon}
                            label="In Progress"
                            value={stats.inProgress}
                            onClick={() => navigate('/officer/cases?filter=in_progress')}
                        />
                        <StatCard
                            icon={ClockIcon}
                            label="Closure Requested"
                            value={stats.pendingClosure}
                            onClick={() => navigate('/officer/cases?filter=pending_closure')}
                        />
                        <StatCard
                            icon={CheckBadgeIcon}
                            label="Closed"
                            value={stats.closed}
                            onClick={() => navigate('/officer/cases?filter=closed')}
                        />
                    </div>
                )}
            </div>
        </Layout>
    )
}

export default OfficerDashboard