/**
 * CRIMEX Mock API updates:
 * - Neutralize admin users list and station investigators endpoints to prevent code-driven extra roles appearing.
 * - Keep case endpoints intact.
 */

import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { CASE_STATUSES, ROLES } from '../utils/constants'

const USERS_KEY = 'CRIMEX_USERS_V1'
const CASES_KEY = 'CRIMEX_CASES_V1'

const nowISO = () => new Date().toISOString()
const loadJSON = (k, f) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f } catch { return f } }
const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { } }

let users = loadJSON(USERS_KEY, [])
// Neutralize default mock users: do NOT inject any roles by default
if (!Array.isArray(users)) users = []
const saveUsers = () => saveJSON(USERS_KEY, users)

let cases = loadJSON(CASES_KEY, [])
if (!Array.isArray(cases)) cases = []
const saveCases = () => saveJSON(CASES_KEY, cases)

const allowedTransitions = {
    NEW: ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS'],
    TRIAGED: ['ASSIGNED', 'IN_PROGRESS'],
    ASSIGNED: ['IN_PROGRESS', 'CLOSED'],
    IN_PROGRESS: ['CLOSED'],
    CLOSED: []
}

function requireAuth(config) {
    const auth = config.headers?.Authorization || ''
    if (!auth.startsWith('Bearer ')) return [401, { message: 'Unauthorized' }]
    const token = auth.slice('Bearer '.length)
    const userId = token.replace('mock-token-', '')
    const user = users.find(u => u.id === userId)
    if (!user) return [401, { message: 'Invalid token' }]
    return user
}

function loginUser(body) {
    // Keep login minimal; no auto-role creation
    if (body.cnic) {
        return users.find(u => u.cnic === body.cnic && u.password === body.password) || null
    }
    if (body.badgeNumber) {
        return users.find(u => u.badgeNumber === String(body.badgeNumber) && u.password === body.password) || null
    }
    return null
}

function extractCaseId(url, mode) {
    if (!url) return null
    const clean = url.split('?')[0].replace(/\/+$/, '')
    const rx = {
        status: /\/api\/cases\/([^/]+)\/status$/i,
        close: /\/api\/cases\/([^/]+)\/close$/i,
        assign: /\/api\/station\/cases\/([^/]+)\/assign$/i
    }[mode]
    const m = rx?.exec(clean)
    if (m && m[1]) return m[1]
    const seg = clean.split('/').filter(Boolean)
    if (mode === 'status') { const i = seg.lastIndexOf('status'); if (i > 1) return seg[i - 1] }
    if (mode === 'close') { const i = seg.lastIndexOf('close'); if (i > 1) return seg[i - 1] }
    if (mode === 'assign') { const i = seg.lastIndexOf('assign'); if (i > 2) return seg[i - 1] }
    return null
}

const mock = new MockAdapter(axios, { delayResponse: 120 })

// AUTH
mock.onPost('/api/auth/login').reply(config => {
    const body = JSON.parse(config.data || '{}')
    const user = loginUser(body)
    if (!user) return [400, { message: 'Invalid credentials' }]
    return [200, { token: `mock-token-${user.id}`, user }]
})

// ADMIN USERS LIST (neutralize: return empty unless local storage already has entries)
mock.onGet('/api/admin/users').reply(config => {
    const me = requireAuth(config); if (Array.isArray(me)) return me
    // Only return existing local users; do not fabricate roles
    const urlObj = new URL(config.url, 'http://mock')
    const params = Object.fromEntries(urlObj.searchParams.entries())
    let list = [...users]
    if (!params.all) {
        const search = (params.search || '').toLowerCase()
        const role = params.role || ''
        if (search) {
            list = list.filter(u =>
                (u.name || '').toLowerCase().includes(search) ||
                (u.cnic || '').includes(search) ||
                (u.phone || '').includes(search) ||
                (u.badgeNumber || '').includes(search)
            )
        }
        if (role) list = list.filter(u => u.role === role)
        const page = parseInt(params.page || '1', 10)
        const pageSize = parseInt(params.pageSize || '10', 10)
        const start = (page - 1) * pageSize
        const items = list.slice(start, start + pageSize)
        return [200, { items, total: list.length }]
    }
    return [200, { items: list }]
})

// ADMIN ADD USER (keep existing behavior but do not pre-seed any system/station/leo users)
mock.onPost('/api/admin/users').reply(config => {
    const me = requireAuth(config); if (Array.isArray(me)) return me
    const { role, name, phone, password, cnic, badgeNumber } = JSON.parse(config.data || '{}')
    if (!role || !name || !phone || !password || !cnic) return [400, { message: 'Missing required fields' }]
    if (!/^\d{13}$/.test(cnic)) return [400, { message: 'CNIC must be 13 digits' }]
    if (users.some(u => u.cnic === cnic)) return [400, { message: 'CNIC must be unique' }]

    const rec = { id: 'u-' + Math.random().toString(36).slice(2, 6), name, role, phone, password, cnic }
    if (role === ROLES.STATION_ADMIN || role === ROLES.OFFICER) {
        if (!/^\d{4}$/.test(badgeNumber || '')) return [400, { message: 'Badge must be 4 digits' }]
        if (users.some(u => u.badgeNumber === badgeNumber)) return [400, { message: 'Badge number must be unique' }]
        rec.badgeNumber = badgeNumber
    }
    users.push(rec); saveUsers(); return [200, rec]
})

// ADMIN UPDATE USER
mock.onPut(/\/api\/admin\/users\/[^/]+$/).reply(config => {
    const me = requireAuth(config); if (Array.isArray(me)) return me
    const id = config.url.split('/').pop()
    const idx = users.findIndex(u => u.id === id)
    if (idx === -1) return [404, { message: 'User not found' }]
    const body = JSON.parse(config.data || '{}')
    const next = { ...users[idx], ...body }
    if (!next.name || !next.phone || !next.password) return [400, { message: 'Missing fields' }]
    if (!next.role) return [400, { message: 'Role required' }]
    if (!/^\d{13}$/.test(next.cnic || '')) return [400, { message: 'CNIC must be 13 digits' }]
    if (users.some(u => u.id !== id && u.cnic === next.cnic)) return [400, { message: 'CNIC must be unique' }]
    if (next.role === ROLES.OFFICER || next.role === ROLES.STATION_ADMIN) {
        if (!/^\d{4}$/.test(next.badgeNumber || '')) return [400, { message: 'Badge must be 4 digits' }]
        if (users.some(u => u.id !== id && u.badgeNumber === next.badgeNumber)) return [400, { message: 'Badge number must be unique' }]
    }
    users[idx] = next; saveUsers(); return [200, next]
})

// ADMIN DELETE USER
mock.onDelete(/\/api\/admin\/users\/[^/]+$/).reply(config => {
    const me = requireAuth(config); if (Array.isArray(me)) return me
    const id = config.url.split('/').pop()
    const target = users.find(u => u.id === id)
    if (!target) return [404, { message: 'User not found' }]
    users = users.filter(u => u.id !== id); saveUsers(); return [200, { success: true }]
})

// OFFICER CASES
mock.onGet('/api/officer/cases').reply(config => {
    const me = requireAuth(config); if (Array.isArray(me)) return me
    const list = cases.filter(c => c.assignedTo === me.id)
    return [200, list]
})

// CASE DETAIL
mock.onGet(/\/api\/cases\/[^/]+$/).reply(config => {
    const me = requireAuth(config); if (Array.isArray(me)) return me
    const clean = config.url.split('?')[0].replace(/\/+$/, '')
    const id = clean.split('/').pop()
    const found = cases.find(c => c.id === id)
    if (!found) return [404, { message: 'Not found' }]
    const assignedUser = found.assignedTo ? users.find(u => u.id === found.assignedTo) : null
    return [200, { ...found, assignedToName: assignedUser?.name || null }]
})

// UPDATE STATUS
mock.onPut(/\/api\/cases\/[^/]+\/status$/).reply(config => {
    const me = requireAuth(config); if (Array.isArray(me)) return me
    const id = extractCaseId(config.url, 'status')
    if (!id) return [404, { message: 'Case ID parse failed' }]
    const body = JSON.parse(config.data || '{}')
    const found = cases.find(c => c.id === id)
    if (!found) return [404, { message: 'Not found' }]
    if (body.status && body.status !== found.status) {
        const allowed = allowedTransitions[found.status] || []
        if (!allowed.includes(body.status)) return [400, { message: 'Invalid status transition' }]
        found.status = body.status
        if (found.status === CASE_STATUSES.ASSIGNED && !found.assignedAt) found.assignedAt = nowISO()
        if (found.status === CASE_STATUSES.IN_PROGRESS) found.updatedAt = nowISO()
    }
    if (typeof body.notes === 'string') found.internalNotes = body.notes
    found.updatedAt = nowISO()
    saveCases()
    const assignedUser = found.assignedTo ? users.find(u => u.id === found.assignedTo) : null
    return [200, { ...found, assignedToName: assignedUser?.name || null }]
})

// CLOSE CASE
mock.onPost(/\/api\/cases\/[^/]+\/close$/).reply(config => {
    const me = requireAuth(config); if (Array.isArray(me)) return me
    const id = extractCaseId(config.url, 'close')
    if (!id) return [404, { message: 'Case ID parse failed' }]
    const body = JSON.parse(config.data || '{}')
    const found = cases.find(c => c.id === id)
    if (!found) return [404, { message: 'Not found' }]
    found.status = CASE_STATUSES.CLOSED
    found.closureReason = body.reason
    found.finalRemarks = body.remarks
    found.closedAt = nowISO()
    found.updatedAt = found.closedAt
    saveCases()
    const assignedUser = found.assignedTo ? users.find(u => u.id === found.assignedTo) : null
    return [200, { ...found, assignedToName: assignedUser?.name || null }]
})

// STATION ADMIN UNASSIGNED
mock.onGet('/api/station/cases/unassigned').reply(config => {
    const me = requireAuth(config); if (Array.isArray(me)) return me
    const list = cases.filter(c => !c.assignedTo && c.status !== CASE_STATUSES.CLOSED)
    return [200, list]
})

// STATION ADMIN ASSIGNED
mock.onGet('/api/station/cases/assigned').reply(config => {
    const me = requireAuth(config); if (Array.isArray(me)) return me
    const list = cases
        .filter(c => c.assignedTo && c.status !== CASE_STATUSES.CLOSED)
        .map(c => {
            const officer = users.find(u => u.id === c.assignedTo)
            return { ...c, assignedToName: officer?.name || null, assignedToBadge: officer?.badgeNumber || null }
        })
    return [200, list]
})

// STATION ADMIN INVESTIGATORS (neutralize: return empty to avoid code-driven workload users)
mock.onGet('/api/station/investigators').reply(config => {
    const me = requireAuth(config); if (Array.isArray(me)) return me
    return [200, []]
})

// STATION ADMIN ASSIGN CASE
mock.onPost(/\/api\/station\/cases\/[^/]+\/assign$/).reply(config => {
    const me = requireAuth(config); if (Array.isArray(me)) return me
    const id = extractCaseId(config.url, 'assign')
    if (!id) return [404, { message: 'Case ID parse failed' }]
    const body = JSON.parse(config.data || '{}')
    const found = cases.find(c => c.id === id)
    if (!found) return [404, { message: 'Case not found' }]
    const officer = users.find(u => u.id === body.investigatorId)
    if (!officer) return [400, { message: 'Invalid LEO' }]
    found.assignedTo = officer.id
    found.status = CASE_STATUSES.ASSIGNED
    found.assignedAt = nowISO()
    found.updatedAt = found.assignedAt
    saveCases()
    return [200, { success: true }]
})

export default mock