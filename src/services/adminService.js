import { supabase } from '../lib/supabase.js';

// Read Station Admin info saved by your authService into localStorage
export async function getCurrentStationAdmin() {
    const raw = localStorage.getItem('crimex_session');
    if (!raw) return null;
    const { profile, role } = JSON.parse(raw);
    if (role !== 'STATION_ADMIN' || !profile?.id) return null;
    return {
        id: profile.id,
        station_id: profile.station_id || null,
        user_id: profile.user_id || null,
        full_name: profile.full_name || null,
    };
}

// Dashboard metrics:
// - Unassigned = ALL reports with status='new' (global, no station filter)
//   This ensures you immediately see your 2 Supabase rows.
// - Open assigned = status in ('assigned','in_progress') AND assigned_station_id = station
// - LEO roster = active LEOs in this station
export async function getDashboardCounts(station_id) {
    // Global count of NEW reports (no station filter)
    const { count: unassignedCount, error: unErr } = await supabase
        .from('crime_reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new');
    if (unErr) console.error('[counts] unassigned error:', unErr);

    // Open assigned for this station only (0 if station_id is missing)
    let openAssigned = 0;
    if (station_id) {
        const { count: openCount, error: openErr } = await supabase
            .from('crime_reports')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_station_id', station_id)
            .in('status', ['assigned', 'in_progress']);
        if (openErr) console.error('[counts] open assigned error:', openErr);
        openAssigned = openCount || 0;
    }

    // LEO roster count
    let leoRoster = 0;
    if (station_id) {
        const { count: leoCount, error: leoErr } = await supabase
            .from('law_enforcement_officers')
            .select('id', { count: 'exact', head: true })
            .eq('station_id', station_id)
            .eq('is_active', true);
        if (leoErr) console.error('[counts] leo roster error:', leoErr);
        leoRoster = leoCount || 0;
    }

    return {
        unassigned: unassignedCount || 0,
        openAssigned,
        leoRoster,
    };
}

export default {
    getCurrentStationAdmin,
    getDashboardCounts,
}