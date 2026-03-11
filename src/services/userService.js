import { supabase } from '../lib/supabase'

// Safe select utility
async function safeSelect(table, selectExpr, { where = [], orderBy = null, useActive = false } = {}) {
    try {
        let query = supabase.from(table).select(selectExpr)
        for (const f of where) query = query.eq(f.column, f.value)
        if (useActive) query = query.eq('is_active', true)
        if (orderBy) query = query.order(orderBy, { ascending: false })
        const { data, error } = await query
        if (error) throw error
        return data || []
    } catch (e) {
        console.warn(`[userService] safeSelect failed for ${table}:`, e?.message || e)
        return []
    }
}

// Map role to table
function tableForRole(role) {
    switch ((role || '').toUpperCase()) {
        case 'LEO': return 'law_enforcement_officers'
        case 'STATION_ADMIN': return 'station_admins'
        case 'SYS_ADMIN': return 'system_admins'
        case 'CITIZEN': return 'users' // citizens live in users
        default: return null
    }
}

export const userService = {
    async getUsers(filters = {}) {
        try {
            const { role, page = 1, pageSize = 100 } = filters
            let items = []
            const upperRole = (role || '').toUpperCase()

            // BASE: combined (LEO + Station Admin + System Admin + Citizens from 'users')
            if (!role || upperRole === 'BASE') {
                const [leos, stations, sysAdmins, citizens] = await Promise.all([
                    safeSelect('law_enforcement_officers', 'id, user_id, full_name, email, cnic, phone, badge_number, created_at', { useActive: true, orderBy: 'created_at' }),
                    safeSelect('station_admins', 'id, user_id, full_name, email, cnic, phone, badge_number, created_at', { useActive: true, orderBy: 'created_at' }),
                    safeSelect('system_admins', 'id, user_id, full_name, email, cnic, phone, created_at', { useActive: true, orderBy: 'created_at' }),
                    safeSelect('users', 'id, full_name, email, cnic, phone, created_at', { useActive: false, orderBy: 'created_at' }),
                ])

                items = [
                    ...leos.map(r => ({ id: r.id, user_id: r.user_id, name: r.full_name, email: r.email, cnic: r.cnic, phone: r.phone, role: 'LEO', badgeNumber: r.badge_number, station: null, created_at: r.created_at })),
                    ...stations.map(r => ({ id: r.id, user_id: r.user_id, name: r.full_name, email: r.email, cnic: r.cnic, phone: r.phone, role: 'STATION_ADMIN', badgeNumber: r.badge_number, station: null, created_at: r.created_at })),
                    ...sysAdmins.map(r => ({ id: r.id, user_id: r.user_id, name: r.full_name, email: r.email, cnic: r.cnic, phone: r.phone, role: 'SYS_ADMIN', badgeNumber: null, station: 'HQ', created_at: r.created_at })),
                    ...citizens.map(r => ({ id: r.id, user_id: r.id, name: r.full_name, email: r.email, cnic: r.cnic, phone: r.phone, role: 'CITIZEN', badgeNumber: null, station: null, created_at: r.created_at })),
                ]

                items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                const start = (page - 1) * pageSize
                return { items: items.slice(start, start + pageSize), total: items.length }
            }

            // Role-specific views
            if (upperRole === 'LEO') {
                const officers = await safeSelect('law_enforcement_officers', '*, police_stations(station_name)', { useActive: true, orderBy: 'created_at' })
                return {
                    items: officers.map(o => ({
                        id: o.id, user_id: o.user_id, name: o.full_name, email: o.email, cnic: o.cnic, phone: o.phone,
                        role: 'LEO', station: o.police_stations?.station_name || 'Unknown', badgeNumber: o.badge_number, rank: o.rank, created_at: o.created_at
                    })),
                    total: officers.length
                }
            } else if (upperRole === 'STATION_ADMIN') {
                const stationAdmins = await safeSelect('station_admins', '*, police_stations(station_name)', { useActive: true, orderBy: 'created_at' })
                return {
                    items: stationAdmins.map(a => ({
                        id: a.id, user_id: a.user_id, name: a.full_name, email: a.email, cnic: a.cnic, phone: a.phone,
                        role: 'STATION_ADMIN', station: a.police_stations?.station_name || 'Unknown', badgeNumber: a.badge_number, created_at: a.created_at
                    })),
                    total: stationAdmins.length
                }
            } else if (upperRole === 'SYS_ADMIN') {
                const admins = await safeSelect('system_admins', 'id, user_id, full_name, email, cnic, phone, created_at', { useActive: true, orderBy: 'created_at' })
                return {
                    items: admins.map(a => ({
                        id: a.id, user_id: a.user_id, name: a.full_name, email: a.email, cnic: a.cnic, phone: a.phone,
                        role: 'SYS_ADMIN', station: 'HQ', badgeNumber: null, created_at: a.created_at
                    })),
                    total: admins.length
                }
            } else if (upperRole === 'CITIZEN') {
                const citizens = await safeSelect('users', 'id, full_name, email, cnic, phone, created_at', { useActive: false, orderBy: 'created_at' })
                return {
                    items: citizens.map(c => ({
                        id: c.id, user_id: c.id, name: c.full_name, email: c.email, cnic: c.cnic, phone: c.phone,
                        role: 'CITIZEN', station: null, badgeNumber: null, created_at: c.created_at
                    })),
                    total: citizens.length
                }
            }

            return { items: [], total: 0 }
        } catch (error) {
            console.error('Get users error:', error)
            throw error
        }
    },

    // CREATE user in role-specific tables (System Admin, Station Admin, LEO)
    // Citizens are typically created via auth/users; not handled here.
    async createUser(userData) {
        try {
            const { role, email, password, full_name, cnic, phone, badge_number, station_id, rank } = userData
            const upperRole = (role || '').toUpperCase()

            if (!upperRole || !full_name || !cnic || !phone) {
                throw new Error('Missing required fields')
            }
            if (!/^\d{13}$/.test(cnic || '')) {
                throw new Error('CNIC must be 13 digits')
            }

            let table = null
            let insertData = {
                email,
                full_name,
                cnic,
                phone,
                is_active: true,
            }
            if (password) insertData.password_hash = password

            if (upperRole === 'SYS_ADMIN') {
                table = 'system_admins'
            } else if (upperRole === 'STATION_ADMIN') {
                table = 'station_admins'
                if (!station_id) throw new Error('station_id is required for Station Admin')
                if (!/^\d{4}$/.test(badge_number || '')) throw new Error('Badge must be 4 digits')
                insertData = { ...insertData, badge_number, station_id }
            } else if (upperRole === 'LEO' || upperRole === 'OFFICER') {
                table = 'law_enforcement_officers'
                if (!station_id) throw new Error('station_id is required for LEO')
                if (!/^\d{4}$/.test(badge_number || '')) throw new Error('Badge must be 4 digits')
                insertData = { ...insertData, badge_number, station_id, rank: rank || 'Constable' }
            } else {
                // Citizens creation is out of scope here (via auth/users)
                throw new Error('Unsupported role for createUser')
            }

            const { data, error } = await supabase
                .from(table)
                .insert(insertData)
                .select()
                .single()

            if (error) throw error
            if (data?.id && !data.user_id) {
                const { data: updated, error: updateError } = await supabase
                    .from(table)
                    .update({ user_id: data.id })
                    .eq('id', data.id)
                    .select()
                    .single()
                if (updateError) throw updateError
                return updated
            }
            return data
        } catch (error) {
            console.error('Create user error:', error)
            throw error
        }
    },

    // Update role row (NOT citizens)
    async updateUser(id, role, updates) {
        try {
            const table = tableForRole(role)
            if (!table) throw new Error('Unknown role')
            if ((role || '').toUpperCase() === 'CITIZEN') {
                // Admin cannot edit citizens
                throw new Error('Admin cannot update citizen data')
            }
            const { data, error } = await supabase
                .from(table)
                .update(updates)
                .eq('id', id)
                .select()
                .single()
            if (error) throw error
            return data
        } catch (error) {
            console.error('Update user error:', error)
            throw error
        }
    },

    // Delete: citizens -> users table; admins/officers -> their tables
    async deleteUser(id, role) {
        try {
            const table = tableForRole(role)
            if (!table) throw new Error('Unknown role')

            // Perform delete and verify rows affected (RLS must allow DELETE)
            const { data, error } = await supabase
                .from(table)
                .delete()
                .eq('id', id)
                .select('id') // returns deleted ids if any

            if (error) throw error
            if (!data || data.length === 0) {
                // If no rows were deleted, it is likely RLS blocking DELETE.
                // Add Supabase DELETE policies for role tables to allow client-side deletes.
                // See guidance provided: create DELETE policies for law_enforcement_officers, station_admins, system_admins.
                throw new Error('Delete did not affect any rows. Check Supabase RLS DELETE policies.')
            }
            return true
        } catch (error) {
            console.error('Delete user error:', error)
            throw error
        }
    },

    // Fetch police stations for dropdowns (used by Add User)
    async getPoliceStations() {
        try {
            const { data, error } = await supabase
                .from('police_stations')
                .select('id, station_name, city, province')
                .order('station_name', { ascending: true })
            if (error) throw error
            return data || []
        } catch (error) {
            console.error('Get police stations error:', error)
            return []
        }
    },
}

export default userService