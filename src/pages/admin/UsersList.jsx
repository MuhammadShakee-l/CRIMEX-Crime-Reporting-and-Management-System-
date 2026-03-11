import React, { useEffect, useMemo, useState, useCallback } from 'react'
import Layout from '../../components/Layout'
import { toast } from 'react-toastify'
import { useSearchParams } from 'react-router-dom'
import userService from '../../services/userService'
import EditUserModal from '../../components/EditUserModal'

const UsersList = () => {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [rows, setRows] = useState([])
    const [total, setTotal] = useState(0)
    const [search, setSearch] = useState('')

    const [params] = useSearchParams()
    const roleParam = (params.get('role') || 'BASE').toUpperCase()

    const [editing, setEditing] = useState(null)

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const { items, total } = await userService.getUsers({ role: roleParam, page: 1, pageSize: 500 })
            setRows(items || [])
            setTotal(total || 0)
        } catch (e) {
            setError(e?.message || 'Failed to load users')
            toast.error(e?.message || 'Failed to load users')
            setRows([])
            setTotal(0)
        } finally {
            setLoading(false)
        }
    }, [roleParam])

    useEffect(() => { load() }, [load])

    const filtered = useMemo(() => {
        const t = search.trim().toLowerCase()
        if (!t) return rows
        return rows.filter(r =>
            (r.name || '').toLowerCase().includes(t) ||
            (r.cnic || '').includes(t) ||
            (r.email || '').toLowerCase().includes(t) ||
            (r.phone || '').includes(t) ||
            (r.badgeNumber || '').includes(t)
        )
    }, [rows, search])

    const titleByRole = {
        BASE: 'Users',
        LEO: 'LEOs',
        STATION_ADMIN: 'Station Admins',
        SYS_ADMIN: 'System Admins',
        CITIZEN: 'Citizens',
    }

    const canEdit = (role) => role === 'LEO' || role === 'STATION_ADMIN' || role === 'SYS_ADMIN'
    const canDelete = (role) => role === 'LEO' || role === 'STATION_ADMIN' || role === 'SYS_ADMIN' || role === 'CITIZEN'

    const openEdit = (row) => {
        if (!canEdit(row.role)) {
            toast.info('Citizens cannot be updated by admin.')
            return
        }
        setEditing(row)
    }
    const closeEdit = () => setEditing(null)

    const submitEdit = async (updates) => {
        if (!editing) return
        try {
            const updated = await userService.updateUser(editing.id, editing.role, updates)
            toast.success('User updated')
            setRows(prev => prev.map(r => {
                if ((r.id || r.user_id) !== (editing.id || editing.user_id)) return r
                return {
                    ...r,
                    name: updated.full_name ?? r.name,
                    phone: updated.phone ?? r.phone,
                    email: updated.email ?? r.email,
                    badgeNumber: updated.badge_number ?? r.badgeNumber,
                }
            }))
            closeEdit()
        } catch (e) {
            toast.error(e?.message || 'Failed to update user')
        }
    }

    const handleDelete = async (row) => {
        try {
            await userService.deleteUser(row.id, row.role)
            toast.success('User deleted')
            setRows(prev => prev.filter(r => (r.id || r.user_id) !== (row.id || row.user_id)))
            setTotal(prev => Math.max(0, prev - 1))
        } catch (e) {
            toast.error(e?.message || 'Failed to delete user')
        }
    }

    return (
        <Layout>
            <div className="card p-6 mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-display font-semibold">{titleByRole[roleParam] || 'Users'}</h1>
                        <p className="text-sm text-base-muted mt-1">Showing {titleByRole[roleParam] || 'Users'} from database. Total: {total}</p>
                    </div>
                    <button className="btn">Add User</button>
                </div>
                <div className="mt-4 max-w-sm">
                    <input
                        className="input-base"
                        placeholder="Search name, CNIC, email, phone, badge"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {error && (
                <div className="card p-4 mb-6 text-sm text-semantic-danger border border-semantic-danger/40 bg-semantic-danger/10">
                    {error}
                </div>
            )}

            <div className="card p-0 overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="text-left border-b border-base-200">
                            <th className="p-3">NAME</th>
                            <th className="p-3">ROLE</th>
                            <th className="p-3">CNIC</th>
                            <th className="p-3">BADGE</th>
                            <th className="p-3">PHONE</th>
                            <th className="p-3">EMAIL</th>
                            <th className="p-3">ACTION</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(u => (
                            <tr key={u.id || u.user_id} className="border-b border-base-200">
                                <td className="p-3">{u.name || '—'}</td>
                                <td className="p-3">{u.role || '—'}</td>
                                <td className="p-3">{u.cnic || '—'}</td>
                                <td className="p-3">{u.badgeNumber || '—'}</td>
                                <td className="p-3">{u.phone || '—'}</td>
                                <td className="p-3">{u.email || '—'}</td>
                                <td className="p-3">
                                    <div className="flex gap-2">
                                        <button
                                            className="btn btn-sm"
                                            disabled={!canEdit(u.role)}
                                            onClick={() => openEdit(u)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="btn btn-sm btn-danger"
                                            disabled={!canDelete(u.role)}
                                            onClick={() => handleDelete(u)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td className="p-4 text-base-muted" colSpan={7}>No users</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <EditUserModal
                open={!!editing}
                user={editing}
                onClose={closeEdit}
                onSubmit={submitEdit}
            />
        </Layout>
    )
}

export default UsersList