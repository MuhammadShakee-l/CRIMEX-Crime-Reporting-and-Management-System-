import React, { useEffect, useState, useCallback } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase.js'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import {
    UserGroupIcon,
    ShieldCheckIcon,
    BuildingOffice2Icon,
    UserIcon,
    Cog8ToothIcon,
} from '@heroicons/react/24/solid'

async function safeCount(table, { where = [], useActive = false } = {}) {
    try {
        let query = supabase.from(table).select('id', { count: 'exact', head: true })
        for (const f of where) query = query.eq(f.column, f.value)
        if (useActive) query = query.eq('is_active', true)
        const { count, error } = await query
        if (error) throw error
        return count || 0
    } catch (e) {
        console.warn(`[dashboard] safeCount failed for ${table}:`, e?.message || e)
        return 0
    }
}

const AdminDashboard = () => {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [counts, setCounts] = useState({ totalUsers: 0, leos: 0, stationAdmins: 0, systemAdmins: 0, citizens: 0 })
    const navigate = useNavigate()

    const goTo = useCallback((role) => navigate(`/admin/users?role=${encodeURIComponent(role)}`), [navigate])

    const loadCounts = async () => {
        setLoading(true)
        setError('')
        try {
            const [leos, stations, sys, citizens] = await Promise.all([
                safeCount('law_enforcement_officers', { useActive: true }),
                safeCount('station_admins', { useActive: true }),
                safeCount('system_admins', { useActive: true }),
                // citizens from 'users' table
                safeCount('users', { useActive: false }),
            ])

            setCounts({
                totalUsers: leos + stations + sys + citizens,
                leos, stationAdmins: stations, systemAdmins: sys, citizens
            })
        } catch (e) {
            setError(e?.message || 'Failed to load dashboard counts')
            toast.error(e?.message || 'Failed to load dashboard counts')
            setCounts({ totalUsers: 0, leos: 0, stationAdmins: 0, systemAdmins: 0, citizens: 0 })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadCounts() }, [])

    const Card = ({ title, value, Icon, onClick, tone = '', iconClass = '' }) => (
        <button type="button" className="card p-5 flex items-center gap-3 text-left hover:bg-base-200/30 transition-colors cursor-pointer" onClick={onClick}>
            <div className={`stat-icon-wrap ${tone}`}>
                {Icon ? <Icon className={`stat-icon ${iconClass}`} /> : '👥'}
            </div>
            <div>
                <div className="text-xs text-base-muted">{title}</div>
                <div className="text-xl font-semibold">{value}</div>
            </div>
        </button>
    )

    return (
        <Layout>
            <div className="card p-6 mb-6">
                <h1 className="text-xl font-display font-semibold">System Admin Dashboard</h1>
                <p className="text-sm text-base-muted mt-1">Counts reflect actual database records. Click a card to view users.</p>
            </div>

            {error && <div className="card p-4 mb-6 text-sm text-semantic-danger border border-semantic-danger/40 bg-semantic-danger/10">{error}</div>}

            {loading ? (
                <p className="text-base-muted">Loading...</p>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card title="TOTAL USERS" value={counts.totalUsers} Icon={UserGroupIcon} tone="tone-green" iconClass="text-greenbrand-light" onClick={() => goTo('BASE')} />
                    <Card title="LEOS" value={counts.leos} Icon={ShieldCheckIcon} tone="tone-emerald" iconClass="text-emerald-300" onClick={() => goTo('LEO')} />
                    <Card title="CITIZENS" value={counts.citizens} Icon={UserIcon} tone="tone-amber" iconClass="text-amber-200" onClick={() => goTo('CITIZEN')} />
                    <Card title="STATION ADMINS" value={counts.stationAdmins} Icon={BuildingOffice2Icon} tone="tone-blue" iconClass="text-sky-300" onClick={() => goTo('STATION_ADMIN')} />
                    <Card title="SYSTEM ADMINS" value={counts.systemAdmins} Icon={Cog8ToothIcon} tone="tone-slate" iconClass="text-slate-200" onClick={() => goTo('SYS_ADMIN')} />
                </div>
            )}
        </Layout>
    )
}

export default AdminDashboard