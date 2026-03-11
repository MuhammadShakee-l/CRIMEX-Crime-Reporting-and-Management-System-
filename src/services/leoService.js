import { supabase } from '../lib/supabase.js'

// ---------- Session helpers ----------
function safeParse(item) {
    if (!item) return null
    try { return JSON.parse(item) } catch { return null }
}
function getStoredAuth() {
    const user = safeParse(localStorage.getItem('crimex_user'))
    const role = localStorage.getItem('crimex_role') || null
    if (user && role === 'OFFICER') return { user, role }
    return null
}
async function getCurrentOfficer() {
    const stored = getStoredAuth()
    if (!stored) throw new Error('Unauthorized: not signed in')
    if (stored.role !== 'OFFICER') throw new Error('Unauthorized: not an officer')

    const leoId = stored.user?.id
    if (!leoId) throw new Error('Invalid session: missing officer id')

    const { data: rows, error } = await supabase
        .from('law_enforcement_officers')
        .select('id, full_name, is_active')
        .eq('id', leoId)
        .limit(1)
    if (error) throw error
    const leo = rows?.[0]
    if (!leo) throw new Error('LEO record not found')
    if (leo.is_active === false) throw new Error('LEO is inactive')
    return leo
}

// ---------- LEO roster ----------
export async function getLeoRosterAll({ stationId } = {}) {
    let offQ = supabase
        .from('law_enforcement_officers')
        .select('id, full_name, badge_number, is_active, station_id, user_id')
        .eq('is_active', true)
        .order('full_name', { ascending: true })
    if (stationId) offQ = offQ.eq('station_id', stationId)

    const { data: officers, error: offErr } = await offQ
    if (offErr) throw offErr

    const leoIds = (officers || []).map(o => o.id)
    const workloadByLeo = new Map()
    if (leoIds.length > 0) {
        const { data: assignments, error: asgErr } = await supabase
            .from('case_assignments')
            .select('leo_id, status')
            .in('leo_id', leoIds)
            .in('status', ['assigned', 'in_progress'])
        if (asgErr) throw asgErr
        for (const row of (assignments || [])) {
            workloadByLeo.set(row.leo_id, (workloadByLeo.get(row.leo_id) ?? 0) + 1)
        }
    }

    return (officers || []).map(o => ({
        id: o.id,
        full_name: o.full_name || '—',
        badge_number: o.badge_number || '—',
        workload: workloadByLeo.get(o.id) ?? 0,
        station_id: o.station_id ?? null,
        user_id: o.user_id ?? null,
    }))
}

// ---------- Helpers to fetch citizen CNIC ----------
async function fetchReportsWithUserLink(reportIds) {
    // Try common foreign key columns to users table and return the first that exists:
    const candidates = ['citizen_id', 'reporter_id', 'user_id', 'created_by', 'submitted_by']
    for (const col of candidates) {
        try {
            const { data, error } = await supabase
                .from('crime_reports')
                .select(`id, case_number, category, status, updated_at, created_at, ${col}`)
                .in('id', reportIds)
            if (error) continue
            // Ensure the column actually exists on returned rows
            if (Array.isArray(data) && data.length > 0 && col in (data[0] || {})) {
                return { reports: data || [], userIdColumn: col }
            }
        } catch {
            // ignore and try next column
        }
    }
    // Fallback: no user link found; fetch base fields only
    const { data, error } = await supabase
        .from('crime_reports')
        .select('id, case_number, category, status, updated_at, created_at')
        .in('id', reportIds)
    if (error) throw error
    return { reports: data || [], userIdColumn: null }
}

async function loadCnicForUserIds(userIds) {
    if (!userIds || userIds.length === 0) return new Map()
    const unique = Array.from(new Set(userIds.filter(Boolean)))
    if (unique.length === 0) return new Map()
    const { data, error } = await supabase
        .from('users')
        .select('id, cnic')
        .in('id', unique)
    if (error) throw error
    const map = new Map()
    for (const u of (data || [])) {
        map.set(u.id, u.cnic || '—')
    }
    return map
}

// ---------- LEO cases list (Officer view) ----------
export async function loadLeoCases({ status } = {}) {
    const leo = await getCurrentOfficer()
    const leoId = leo.id

    let asgQ = supabase
        .from('case_assignments')
        .select('report_id, status, assigned_at, updated_at, started_at, completed_at')
        .eq('leo_id', leoId)
        .order('updated_at', { ascending: false }) // surface latest updates
    if (status && status !== 'all') asgQ = asgQ.eq('status', status)

    const { data: assignments, error: asgErr } = await asgQ
    if (asgErr) throw asgErr
    const list = assignments || []

    const reportIds = list.map(a => a.report_id).filter(Boolean)
    if (reportIds.length === 0) return []

    // Fetch reports plus whichever user-id column exists (citizen_id/reporter_id/user_id/…)
    const { reports, userIdColumn } = await fetchReportsWithUserLink(reportIds)

    // Build status/assigned time maps from assignments
    const statusByCaseId = new Map(list.map(a => [a.report_id, a.status]))
    const assignedAtByCaseId = new Map(list.map(a => [a.report_id, a.assigned_at]))

    // If we detected a user id column on crime_reports, fetch CNICs for those users
    let cnicByUserId = new Map()
    if (userIdColumn) {
        const userIds = reports.map(r => r[userIdColumn]).filter(Boolean)
        try {
            cnicByUserId = await loadCnicForUserIds(userIds)
        } catch {
            cnicByUserId = new Map()
        }
    }

    const rows = (reports || []).map(r => {
        const userId = userIdColumn ? r[userIdColumn] : null
        const citizen_cnic = (userId && cnicByUserId.has(userId)) ? cnicByUserId.get(userId) : '—'
        return {
            id: r.id,
            case_number: r.case_number,
            title: r.category || '—',
            citizen_cnic, // CNIC from users table when available; fallback to '—'
            // Prefer assignment status for folder view; fallback to report status
            status: statusByCaseId.get(r.id) || r.status || 'assigned',
            updated_at: r.updated_at || r.created_at,
            assigned_at: assignedAtByCaseId.get(r.id) || null,
            created_at: r.created_at,
        }
    })

    if (status && status !== 'all') {
        const s = status.toLowerCase()
        return rows.filter(r => (statusByCaseId.get(r.id) || r.status || '').toLowerCase() === s)
    }

    return rows
}

// ---------- Case detail (Officer view) ----------
export async function loadCaseDetail(reportId) {
    const sessionLeo = await getCurrentOfficer()
    const sessionLeoId = sessionLeo.id

    // Fetch full report so description/location fields are available
    const { data: reportRow, error: reportErr } = await supabase
        .from('crime_reports')
        .select('*')
        .eq('id', reportId)
        .maybeSingle()
    if (reportErr) throw reportErr
    const report = reportRow || null
    if (!report) throw new Error('Report not found')

    // Detect potential user-id column from the fetched row
    const userIdColumn = ['citizen_id', 'reporter_id', 'user_id', 'created_by', 'submitted_by']
        .find(col => col in report && report[col]) || null

    const { data: assignmentRows, error: asgErr } = await supabase
        .from('case_assignments')
        .select('*')
        .eq('report_id', reportId)
        .eq('leo_id', sessionLeoId)
        .limit(1)
    if (asgErr) throw asgErr
    const assignment = assignmentRows?.[0] || null

    let closure = null
    try {
        const { data: closureRows, error: closureErr } = await supabase
            .from('case_closure_reports')
            .select('*')
            .eq('report_id', reportId)
            .limit(1)
        if (closureErr) throw closureErr
        closure = closureRows?.[0] || null
    } catch (_) {
        // If the table is locked by RLS or missing, skip without breaking detail view
        closure = null
    }

    let officer = { id: sessionLeoId, full_name: sessionLeo.full_name || '—' }
    if (!officer.full_name) {
        const { data: leoRows } = await supabase
            .from('law_enforcement_officers')
            .select('id, full_name')
            .eq('id', sessionLeoId)
            .limit(1)
        if (leoRows?.[0]) officer = leoRows[0]
    }

    // Citizen CNIC via users table (if we identified the user-id column)
    let citizen = null
    if (userIdColumn && report[userIdColumn]) {
        try {
            const { data: u } = await supabase
                .from('users')
                .select('id, full_name, cnic')
                .eq('id', report[userIdColumn])
                .maybeSingle()
            if (u) citizen = { id: u.id, full_name: u.full_name, cnic: u.cnic }
        } catch {
            citizen = null
        }
    }

    // Latest closure update (for legacy rows where closure_reason/final_remarks were not stored)
    let closureUpdate = null
    try {
        const { data: updates } = await supabase
            .from('case_updates')
            .select('notes, new_status, created_at')
            .eq('report_id', reportId)
            .eq('new_status', 'closed')
            .order('created_at', { ascending: false })
            .limit(1)
        closureUpdate = updates?.[0] || null
    } catch (_) {
        closureUpdate = null
    }

    return { report, assignment, citizen, officer, closure, closureUpdate }
}

// ---------- Status updates ----------
export async function markCaseInProgress(reportId) {
    const leo = await getCurrentOfficer()
    const leoId = leo.id
    const now = new Date().toISOString()

    const { data, error } = await supabase
        .from('case_assignments')
        .update({ status: 'in_progress', started_at: now, updated_at: now })
        .eq('report_id', reportId)
        .eq('leo_id', leoId)
        .select('*')
        .limit(1)
    if (error) throw error
    const row = data?.[0] || null

    const { error: reportErr } = await supabase
        .from('crime_reports')
        .update({ status: 'in_progress', updated_at: now })
        .eq('id', reportId)
    if (reportErr) throw reportErr

    try {
        await supabase
            .from('case_updates')
            .insert({
                report_id: reportId,
                old_status: 'assigned',
                new_status: 'in_progress',
                notes: 'Work started.',
                created_at: now,
            })
    } catch (_) { }

    return row
}

// ---------- Request closure (sends to station admin for approval) ----------
export async function requestClosure(reportId, { reason, remarks } = {}) {
    const leo = await getCurrentOfficer()
    const leoId = leo.id
    const now = new Date().toISOString()

    const safeRemarks = (remarks && remarks.trim()) ? remarks.trim() : 'No additional remarks.'
    const requestNotes = `CLOSURE_REQUEST | Reason: ${reason || 'N/A'} | Remarks: ${safeRemarks}`

    const { data, error } = await supabase
        .from('case_assignments')
        .update({
            status: 'pending_closure',
            assignment_notes: requestNotes,
            updated_at: now,
        })
        .eq('report_id', reportId)
        .eq('leo_id', leoId)
        .select('*')
        .limit(1)
    if (error) throw error

    try {
        await supabase.from('case_updates').insert({
            report_id: reportId,
            old_status: 'in_progress',
            new_status: 'pending_closure',
            notes: `Closure requested. Reason: ${reason || 'N/A'}. Remarks: ${safeRemarks}`,
            created_at: now,
        })
    } catch (_) { }

    return data?.[0] || null
}

export async function closeCase(reportId, { reason, remarks } = {}) {
    const leo = await getCurrentOfficer()
    const leoId = leo.id
    const now = new Date().toISOString()

    const normalizedReason = (reason || 'Other').toLowerCase().replace(/\s+/g, '_')
    const safeRemarks = (remarks && remarks.trim()) ? remarks.trim() : 'No additional remarks provided.'
    const assignmentNotes = `Reason: ${reason || 'N/A'} | Remarks: ${safeRemarks}`

    let assignmentRow = null
    let closureRow = null
    try {
        const { data, error } = await supabase
            .from('case_assignments')
            .update({
                status: 'closed',
                completed_at: now,
                // Attempt to persist closure details when columns exist
                closure_reason: normalizedReason,
                final_remarks: safeRemarks,
                assignment_notes: assignmentNotes,
                updated_at: now,
            })
            .eq('report_id', reportId)
            .eq('leo_id', leoId)
            .select('*')
            .limit(1)
        if (error) throw error
        assignmentRow = data?.[0] || null
    } catch {
        const { data, error: retryErr } = await supabase
            .from('case_assignments')
            .update({
                status: 'closed',
                completed_at: now,
                assignment_notes: assignmentNotes,
                updated_at: now,
            })
            .eq('report_id', reportId)
            .eq('leo_id', leoId)
            .select('*')
            .limit(1)
        if (retryErr) throw retryErr
        assignmentRow = data?.[0] || null
    }

    // Best-effort: create or update the closure report record when allowed by RLS
    try {
        const { data: closureData, error: closureErr } = await supabase
            .from('case_closure_reports')
            .upsert({
                report_id: reportId,
                closed_by: leoId,
                closure_reason: normalizedReason,
                final_remarks: safeRemarks,
                investigation_summary: safeRemarks,
                closed_at: now,
            }, { onConflict: 'report_id' })
            .select('*')
            .limit(1)
        if (closureErr) throw closureErr
        closureRow = closureData?.[0] || null
    } catch (_) {
        closureRow = null
    }

    // Always prepare a local closure snapshot so the UI can display reason/remarks even if RLS blocks persistence
    if (!closureRow) {
        closureRow = {
            report_id: reportId,
            closed_by: leoId,
            closure_reason: normalizedReason,
            final_remarks: safeRemarks,
            closed_at: now,
        }
    }

    const { error: reportErr } = await supabase
        .from('crime_reports')
        .update({ status: 'closed', updated_at: now })
        .eq('id', reportId)
    if (reportErr) throw reportErr

    try {
        await supabase
            .from('case_updates')
            .insert({
                report_id: reportId,
                old_status: 'in_progress',
                new_status: 'closed',
                notes: reason ? `Closed: ${reason}. Remarks: ${safeRemarks}` : `Closed. Remarks: ${safeRemarks}`,
                created_at: now,
            })
    } catch (_) { }

    return { assignment: assignmentRow, closure: closureRow }
}

// ---------- Dashboard counts ----------
export async function loadLeoDashboardCounts() {
    const leo = await getCurrentOfficer()
    const leoId = leo.id

    const totalRes = await supabase
        .from('case_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('leo_id', leoId)
    if (totalRes.error) throw totalRes.error

    const [assignedRes, inProgRes, pendingRes, closedRes] = await Promise.all([
        supabase
            .from('case_assignments')
            .select('id', { count: 'exact', head: true })
            .eq('leo_id', leoId)
            .eq('status', 'assigned'),
        supabase
            .from('case_assignments')
            .select('id', { count: 'exact', head: true })
            .eq('leo_id', leoId)
            .eq('status', 'in_progress'),
        supabase
            .from('case_assignments')
            .select('id', { count: 'exact', head: true })
            .eq('leo_id', leoId)
            .eq('status', 'pending_closure'),
        supabase
            .from('case_assignments')
            .select('id', { count: 'exact', head: true })
            .eq('leo_id', leoId)
            .eq('status', 'closed'),
    ])

    return {
        total: totalRes.count ?? 0,
        assigned: assignedRes.count ?? 0,
        inProgress: inProgRes.count ?? 0,
        pendingClosure: pendingRes.count ?? 0,
        closed: closedRes.count ?? 0,
    }
}

export default {
    loadLeoCases,
    loadCaseDetail,
    markCaseInProgress,
    requestClosure,
    closeCase,
    loadLeoDashboardCounts,
    getLeoRosterAll,
}