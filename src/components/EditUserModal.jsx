import React, { useEffect, useMemo, useState } from 'react'
import PasswordStrengthChecklist, { validatePassword } from './PasswordStrengthChecklist'

/**
 * EditUserModal
 * Props:
 * - open: boolean
 * - user: { id, role, name, cnic, phone, email, badgeNumber }
 * - onClose: () => void
 * - onSubmit: (updates) => Promise<void>
 *
 * Behavior:
 * - Citizens: fields readonly; Update disabled
 * - LEO/Station Admin: can edit name, phone, email, badge_number
 * - Sys Admin: can edit name, phone, email
 */
export default function EditUserModal({ open, user, onClose, onSubmit }) {
    const [roleLabel, setRoleLabel] = useState('')
    const [fullName, setFullName] = useState('')
    const [cnic, setCnic] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [badge, setBadge] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)

    useEffect(() => {
        if (!open) return
        setRoleLabel((user?.role || '').toUpperCase())
        setFullName(user?.name || '')
        setCnic(user?.cnic || '')
        setPhone(user?.phone || '')
        setEmail(user?.email || '')
        setBadge(user?.badgeNumber || '')
        setPassword('')
        setShowPassword(false)
    }, [open, user])

    const isCitizen = useMemo(() => roleLabel === 'CITIZEN', [roleLabel])
    const isLeoOrStation = useMemo(() => roleLabel === 'LEO' || roleLabel === 'STATION_ADMIN', [roleLabel])
    const isSysAdmin = useMemo(() => roleLabel === 'SYS_ADMIN', [roleLabel])

    const disabled = isCitizen

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (disabled) return
        if (email && !email.toLowerCase().endsWith('@gmail.com')) {
            alert('Invalid email — only @gmail.com addresses are accepted')
            return
        }
        if (phone && !/^\d{11}$/.test(phone)) {
            alert('Phone number must be exactly 11 digits')
            return
        }
        if (password.trim() && !validatePassword(password.trim())) {
            alert('Password does not meet the requirements — check the checklist below the field')
            return
        }
        const updates = {
            full_name: fullName,
            phone: phone,
            email: email,
        }
        if (isLeoOrStation) updates.badge_number = badge
        if (password.trim()) updates.password_hash = password.trim()
        await onSubmit(updates)
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto p-4">
            <div className="card p-6 w-full max-w-2xl my-auto">
                <h2 className="text-lg font-semibold mb-4">System Admin can create or modify users directly.</h2>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-base-muted">ROLE</label>
                        <select className="input-base mt-1" value={roleLabel} disabled>
                            <option value="SYS_ADMIN">System Admin</option>
                            <option value="STATION_ADMIN">Station Admin</option>
                            <option value="LEO">LEO</option>
                            <option value="CITIZEN">Citizen</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-base-muted">FULL NAME</label>
                        <input
                            className="input-base mt-1"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            disabled={disabled}
                            placeholder="Full name"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-base-muted">CNIC (13 DIGITS)</label>
                        <input
                            className="input-base mt-1"
                            value={cnic}
                            disabled
                            placeholder="e.g., 1234567890123"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-base-muted">PHONE (11 DIGITS)</label>
                        <input
                            className="input-base mt-1"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            disabled={disabled}
                            placeholder="e.g., 03001234567"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="text-xs text-base-muted">EMAIL</label>
                        <input
                            className="input-base mt-1"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={disabled}
                            placeholder="email@example.com"
                        />
                    </div>

                    {isLeoOrStation && (
                        <div className="md:col-span-2">
                            <label className="text-xs text-base-muted">BADGE (4 DIGITS)</label>
                            <input
                                className="input-base mt-1"
                                value={badge}
                                onChange={(e) => setBadge(e.target.value)}
                                disabled={disabled}
                                placeholder="e.g., 4321"
                            />
                        </div>
                    )}

                    {!isCitizen && (
                        <div className="md:col-span-2">
                            <label className="text-xs text-base-muted">NEW PASSWORD <span className="text-white/40">(leave blank to keep current)</span></label>
                            <div className="relative mt-1">
                                <input
                                    className="input-base pr-20"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter new password"
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-base-muted hover:text-white transition"
                                    onClick={() => setShowPassword(v => !v)}
                                >
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                            <PasswordStrengthChecklist password={password} />
                        </div>
                    )}

                    <div className="md:col-span-2 mt-4 flex justify-end gap-2">
                        <button type="button" className="btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={disabled}>
                            Update User
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}