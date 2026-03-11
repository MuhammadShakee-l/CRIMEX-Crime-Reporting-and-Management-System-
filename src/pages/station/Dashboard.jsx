import React, { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import StatCard from '../../components/StatCard'
import { useNavigate } from 'react-router-dom'
import {
    ClipboardDocumentListIcon,
    FolderOpenIcon,
    UsersIcon,
    InboxArrowDownIcon
} from '@heroicons/react/24/outline'
import { supabase } from '../../lib/supabase.js'

const StationDashboard = () => {
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({ unassigned: 0, assigned: 0, leos: 0, receivedRequests: 0 })
    const navigate = useNavigate()

    useEffect(() => {
        const load = async () => {
            try {
                // Global count of NEW reports (should be 2 based on your screenshots)
                const { count: newCount, error: newErr } = await supabase
                    .from('crime_reports')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'new')
                if (newErr) console.error('[Dashboard] NEW count error:', newErr)

                // Resolve station_id from local session, with DB fallback if missing
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

                console.log('[Dashboard] stationId:', stationId)

                // Open assigned for this station
                let openAssigned = 0
                if (stationId) {
                    const { count: openCount, error: openErr } = await supabase
                        .from('crime_reports')
                        .select('id', { count: 'exact', head: true })
                        .eq('assigned_station_id', stationId)
                        .in('status', ['assigned', 'in_progress'])
                    if (openErr) console.error('[Dashboard] Open assigned error:', openErr)
                    openAssigned = openCount || 0
                }

                // LEO roster count — filtered to this station only
                let leoRoster = 0
                if (stationId) {
                    const { count: leoCount, error: leoErr } = await supabase
                        .from('law_enforcement_officers')
                        .select('id', { count: 'exact', head: true })
                        .eq('is_active', true)
                        .eq('station_id', stationId)
                    if (leoErr) console.error('[Dashboard] LEO roster error:', leoErr)
                    leoRoster = leoCount || 0
                } else {
                    // fallback when station_id is not in session
                    const { count: leoCount, error: leoErr } = await supabase
                        .from('law_enforcement_officers')
                        .select('id', { count: 'exact', head: true })
                        .eq('is_active', true)
                    if (leoErr) console.error('[Dashboard] LEO roster error:', leoErr)
                    leoRoster = leoCount || 0
                }

                // Pending closure requests for this station
                // Use leo's station_id as fallback since case_assignments.station_id may be NULL
                let receivedRequests = 0
                if (stationId) {
                    // Get all LEO ids belonging to this station
                    const { data: stationLeos } = await supabase
                        .from('law_enforcement_officers')
                        .select('id')
                        .eq('station_id', stationId)
                    const stationLeoIds = (stationLeos || []).map(l => l.id)

                    if (stationLeoIds.length > 0) {
                        const { count: reqCount, error: reqErr } = await supabase
                            .from('case_assignments')
                            .select('id', { count: 'exact', head: true })
                            .in('leo_id', stationLeoIds)
                            .eq('status', 'pending_closure')
                        if (reqErr) console.error('[Dashboard] Received requests error:', reqErr)
                        receivedRequests = reqCount || 0
                    }
                } else {
                    // fallback: global count when station_id is missing
                    const { count: reqCount } = await supabase
                        .from('case_assignments')
                        .select('id', { count: 'exact', head: true })
                        .eq('status', 'pending_closure')
                    receivedRequests = reqCount || 0
                }

                setStats({
                    unassigned: newCount || 0,
                    assigned: openAssigned,
                    leos: leoRoster,
                    receivedRequests,
                })
                console.log('[Dashboard] stats:', { newCount, openAssigned, leoRoster })
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    return (
        <Layout>
            <div className="card p-6">
                <h1 className="text-2xl font-display font-semibold">Station Admin Dashboard</h1>
                <p className="text-sm text-base-muted mt-1">
                    Operational overview. Click to drill down.
                </p>
                {loading ? (
                    <p className="text-base-muted mt-6">Loading...</p>
                ) : (
                    <div className="stat-grid mt-6">
                        <StatCard
                            icon={ClipboardDocumentListIcon}
                            label="Unassigned Cases"
                            value={stats.unassigned}
                            onClick={() => navigate('/station/assign')}
                        />
                        <StatCard
                            icon={FolderOpenIcon}
                            label="Total Open (Assigned)"
                            value={stats.assigned}
                            onClick={() => navigate('/station/assigned')}
                        />
                        <StatCard
                            icon={UsersIcon}
                            label="LEOs"
                            value={stats.leos}
                            onClick={() => navigate('/station/leos')}
                        />
                        <StatCard
                            icon={InboxArrowDownIcon}
                            label="Received Requests"
                            value={stats.receivedRequests}
                            onClick={() => navigate('/station/requests')}
                        />
                    </div>
                )}
            </div>
        </Layout>
    )
}

export default StationDashboard