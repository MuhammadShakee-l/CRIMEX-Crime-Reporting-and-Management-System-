import React, { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { toast } from 'react-toastify'
import userService from '../../services/userService'
import PasswordStrengthChecklist, { validatePassword } from '../../components/PasswordStrengthChecklist'

const roles = [
    { value: 'SYS_ADMIN', label: 'System Admin' },
    { value: 'STATION_ADMIN', label: 'Station Admin' },
    { value: 'OFFICER', label: 'LEO' },
    // Citizens are created via users (auth) generally; omit here if you don’t want admin to create citizens.
]

const AddUser = () => {
    const [role, setRole] = useState('SYS_ADMIN')
    const [full_name, setFullName] = useState('')
    const [cnic, setCnic] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [badge_number, setBadgeNumber] = useState('')

    const [stations, setStations] = useState([])
    const [station_id, setStationId] = useState('')
    const [stationsLoading, setStationsLoading] = useState(false)
    const [stationsError, setStationsError] = useState('')

    const needsStation = role === 'STATION_ADMIN' || role === 'OFFICER'
    const needsBadge = role === 'STATION_ADMIN' || role === 'OFFICER'

    const loadStations = async () => {
        setStationsLoading(true)
        setStationsError('')
        try {
            const data = await userService.getPoliceStations()
            setStations(data || [])
        } catch (e) {
            setStationsError(e?.message || 'Failed to load police stations')
            toast.error(e?.message || 'Failed to load police stations')
            setStations([])
        } finally {
            setStationsLoading(false)
        }
    }

    useEffect(() => {
        if (needsStation) loadStations()
    }, [role])

    const onSubmit = async (e) => {
        e.preventDefault()
        try {
            if (!role || !full_name || !cnic || !phone || !email || !password) {
                toast.error('Please fill all required fields')
                return
            }
            if (needsStation && !station_id) {
                toast.error('Please select a police station')
                return
            }
            if (needsBadge && !/^\d{4}$/.test(badge_number || '')) {
                toast.error('Badge must be 4 digits')
                return
            }
            if (!/^\d{13}$/.test(cnic || '')) {
                toast.error('CNIC must be 13 digits')
                return
            }
            if (!email.toLowerCase().endsWith('@gmail.com')) {
                toast.error('Invalid email — only @gmail.com addresses are accepted')
                return
            }
            if (!/^\d{11}$/.test(phone || '')) {
                toast.error('Phone number must be exactly 11 digits')
                return
            }
            if (!validatePassword(password)) {
                toast.error('Password does not meet the requirements')
                return
            }

            const payload = {
                role,
                email,
                password,
                full_name,
                cnic,
                phone,
            }
            if (needsStation) payload.station_id = station_id
            if (needsBadge) payload.badge_number = badge_number

            const created = await userService.createUser(payload)
            toast.success('User created')
            // Reset minimal fields
            setFullName(''); setCnic(''); setPhone(''); setEmail(''); setPassword('')
            setBadgeNumber(''); setStationId('')
        } catch (e) {
            toast.error(e?.message || 'Failed to create user')
        }
    }

    return (
        <Layout>
            <div className="card p-6 mb-6">
                <h1 className="text-xl font-display font-semibold">Add User</h1>
                <p className="text-sm text-base-muted mt-1">LEO & Station Admin sign in with badge; System Admin signs in with CNIC.</p>
            </div>

            <div className="card p-6">
                <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-base-muted">ROLE</label>
                        <select className="input-base mt-1" value={role} onChange={(e) => setRole(e.target.value)}>
                            {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-base-muted">FULL NAME</label>
                        <input className="input-base mt-1" value={full_name} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
                    </div>

                    <div>
                        <label className="text-xs text-base-muted">CNIC (13 DIGITS)</label>
                        <input className="input-base mt-1" value={cnic} onChange={(e) => setCnic(e.target.value)} placeholder="1234567890123" />
                    </div>

                    <div>
                        <label className="text-xs text-base-muted">PHONE (11 DIGITS)</label>
                        <input className="input-base mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03001234567" />
                    </div>

                    <div className="md:col-span-2">
                        <label className="text-xs text-base-muted">EMAIL</label>
                        <input className="input-base mt-1" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
                    </div>

                    {/* Police Station for LEO/Station Admin */}
                    {needsStation && (
                        <div className="md:col-span-1">
                            <label className="text-xs text-base-muted">POLICE STATION</label>
                            <select
                                className="input-base mt-1"
                                value={station_id}
                                onChange={(e) => setStationId(e.target.value)}
                            >
                                <option value="">Select Police Station</option>
                                {stationsLoading && <option value="" disabled>Loading...</option>}
                                {stationsError && <option value="" disabled>Error loading stations</option>}
                                {!stationsLoading && !stationsError && stations.map(s => (
                                    <option key={s.id} value={s.id}>{s.station_name} {s.city ? `(${s.city})` : ''}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Badge for LEO/Station Admin */}
                    {needsBadge && (
                        <div className="md:col-span-1">
                            <label className="text-xs text-base-muted">BADGE (4 DIGITS)</label>
                            <input className="input-base mt-1" value={badge_number} onChange={(e) => setBadgeNumber(e.target.value)} placeholder="4321" />
                        </div>
                    )}

                    <div className="md:col-span-2">
                        <label className="text-xs text-base-muted">PASSWORD</label>
                        <input className="input-base mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                        <PasswordStrengthChecklist password={password} />
                    </div>

                    <div className="md:col-span-2 mt-4 flex justify-end gap-2">
                        <button type="button" className="btn">Cancel</button>
                        <button type="submit" className="btn btn-primary">Add User</button>
                    </div>
                </form>
            </div>
        </Layout>
    )
}

export default AddUser