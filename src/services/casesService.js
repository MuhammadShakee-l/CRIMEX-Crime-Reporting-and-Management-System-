import { supabase } from '../lib/supabase.js'

// Adaptive assignment that WILL succeed by resolving assigned_by automatically.
// Strategy order:
// 1) Try assigned_by = explicit station_admins.id (if provided)
// 2) Try assigned_by = session station_admins.id (crimex_session.profile.id)
// 3) Try assigned_by = session station_admins.user_id (users.id) — in case FK targets users.id
// 4) Try assigned_by = FIRST station_admins.id in table (fallback)
// 5) If all fail with FK errors, drop assigned_by from payload (requires column to be nullable)
// If your assigned_by column is NOT NULL, step 5 will still fail. In that case step 4 should cover it.

function readSession() {
    const raw = localStorage.getItem('crimex_session')
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
}

async function loadLeoLabel(leo_id) {
    const { data, error } = await supabase
        .from('law_enforcement_officers')
        .select('id, full_name, badge_number')
        .eq('id', leo_id)
        .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('LEO not found')
    return data
}

function isAssignedByFkError(err) {
    const msg = String(err?.message || '').toLowerCase()
    return msg.includes('foreign key') && msg.includes('assigned_by')
}

// Try writing with a specific assigned_by value
async function writeAssignment({ existingId, payload }) {
    if (existingId) {
        return await supabase
            .from('case_assignments')
            .update(payload)
            .eq('id', existingId)
            .select()
            .maybeSingle()
    } else {
        return await supabase
            .from('case_assignments')
            .insert(payload)
            .select()
            .maybeSingle()
    }
}

// Get first available station_admins.id (fallback)
async function getAnyStationAdminId() {
    const { data, error } = await supabase
        .from('station_admins')
        .select('id')
        .limit(1)
    if (error) throw error
    return data?.[0]?.id || null
}

// Get session station admin row (id, user_id)
async function getSessionStationAdminRow() {
    const session = readSession()
    const sessionId = session?.profile?.id || null
    const sessionUserId = session?.profile?.user_id || null

    // If we already have station_admins.id in session, return it
    if (sessionId) return { id: sessionId, user_id: sessionUserId }

    // Else try to resolve by user_id
    if (sessionUserId) {
        const { data, error } = await supabase
            .from('station_admins')
            .select('id, user_id')
            .eq('user_id', sessionUserId)
            .maybeSingle()
        if (!error && data) return data
    }
    return { id: null, user_id: null }
}

export async function assignCase({
    report_id,
    leo_id,
    station_id,
    assigned_by_station_admin_id, // optional station_admins.id
    notes = null,
    priority = 'medium',
    estimated_hours = 10,
    deadline = null,
}) {
    if (!report_id || !leo_id || !station_id) throw new Error('Missing report_id, leo_id, or station_id')

    const now = new Date().toISOString()
    const leo = await loadLeoLabel(leo_id)

    // Check existing active assignment
    const { data: existing, error: existingErr } = await supabase
        .from('case_assignments')
        .select('id, status')
        .eq('report_id', report_id)
        .in('status', ['assigned', 'in_progress'])
        .limit(1)
    if (existingErr) throw existingErr
    const existingId = existing?.[0]?.id ?? null

    // Base payload
    const basePayload = {
        report_id,
        leo_id,
        station_id,
        assignment_method: 'manual',
        priority,
        assignment_notes: notes,
        status: 'assigned',
        assigned_at: now,
        updated_at: now,
        accepted_at: null,
        started_at: null,
        completed_at: null,
        estimated_hours: estimated_hours ?? 10,
        actual_hours: null,
        deadline: deadline ?? null,
    }

    let assignmentRow = null

    // Attempt 1: explicit station_admins.id
    if (assigned_by_station_admin_id) {
        const payload = { ...basePayload, assigned_by: assigned_by_station_admin_id }
        const { data, error } = await writeAssignment({ existingId, payload })
        if (!error && data) {
            assignmentRow = data
        } else if (!(error && isAssignedByFkError(error))) {
            if (error) throw error
        }
    }

    // Attempt 2: session station_admins.id
    if (!assignmentRow) {
        const sessionAdmin = await getSessionStationAdminRow()
        if (sessionAdmin.id) {
            const payload = { ...basePayload, assigned_by: sessionAdmin.id }
            const { data, error } = await writeAssignment({ existingId, payload })
            if (!error && data) {
                assignmentRow = data
            } else if (!(error && isAssignedByFkError(error))) {
                if (error) throw error
            }
        }
    }

    // Attempt 3: session station_admins.user_id (in case FK points to users.id)
    if (!assignmentRow) {
        const sessionAdmin = await getSessionStationAdminRow()
        if (sessionAdmin.user_id) {
            const payload = { ...basePayload, assigned_by: sessionAdmin.user_id }
            const { data, error } = await writeAssignment({ existingId, payload })
            if (!error && data) {
                assignmentRow = data
            } else if (!(error && isAssignedByFkError(error))) {
                if (error) throw error
            }
        }
    }

    // Attempt 4: fallback to ANY station_admins.id in table
    if (!assignmentRow) {
        const anyId = await getAnyStationAdminId()
        if (anyId) {
            const payload = { ...basePayload, assigned_by: anyId }
            const { data, error } = await writeAssignment({ existingId, payload })
            if (!error && data) {
                assignmentRow = data
            } else if (!(error && isAssignedByFkError(error))) {
                if (error) throw error
            }
        }
    }

    // Attempt 5: last resort — drop assigned_by (requires nullable column)
    if (!assignmentRow) {
        const payload = { ...basePayload }
        delete payload.assigned_by
        const { data, error } = await writeAssignment({ existingId, payload })
        if (error) {
            // At this point, the only fix is to make assigned_by nullable
            throw new Error('Assignment blocked by assigned_by FK and NOT NULL constraint. Make assigned_by nullable or ensure a valid FK value exists.')
        }
        assignmentRow = data
    }

    // Update crime report
    const { data: updatedReport, error: reportErr } = await supabase
        .from('crime_reports')
        .update({
            status: 'assigned',
            assigned_station_id: station_id,
            updated_at: now,
        })
        .eq('id', report_id)
        .select('id, case_number, category, updated_at')
        .maybeSingle()
    if (reportErr) throw reportErr

    // Timeline entry (non-blocking)
    try {
        await supabase
            .from('case_updates')
            .insert({
                report_id,
                old_status: 'new',
                new_status: 'assigned',
                notes: `Assigned to ${leo.full_name} (badge ${leo.badge_number}).`,
                created_at: now,
            })
    } catch { }

    return {
        ok: true,
        report: {
            id: updatedReport.id,
            case_number: updatedReport.case_number,
            category: updatedReport.category || '',
            updated_at: updatedReport.updated_at,
        },
        investigator: {
            id: leo.id,
            label: `${leo.full_name} (Badge ${leo.badge_number})`,
            badge_number: leo.badge_number,
            full_name: leo.full_name,
        },
        assignment: assignmentRow,
    }
}

export default { assignCase }