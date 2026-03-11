import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { toast } from 'react-toastify'
import {
  ShieldCheckIcon,
  UserIcon,
  PhoneIcon,
  LockClosedIcon,
  IdentificationIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import { ROLES, ROLE_LABELS } from '../../utils/constants'

/*
  Updated Signup:
  - Role dropdown (OFFICER, STATION_ADMIN, SYS_ADMIN) - Citizen excluded.
  - Requires CNIC (13 digits), phone (10-11 digits), password.
  - If OFFICER: assign a unique random 4-digit badge (returned by server) and show waiting approval message.
  - All selected roles produce a pending request -> "Waiting for approval from System Admin."
  - Citizen flows remain in separate basic signup (not here).
*/

const selectableRoles = [
  ROLES.OFFICER,
  ROLES.STATION_ADMIN,
  ROLES.SYS_ADMIN
]

const steps = [
  { key: 1, title: 'Info' },
  { key: 2, title: 'Submit' },
  { key: 3, title: 'Done' }
]

const Signup = () => {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    role: ROLES.OFFICER,
    name: '',
    cnic: '',
    phone: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [submittedInfo, setSubmittedInfo] = useState(null)
  const navigate = useNavigate()

  const onChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const validate = () => {
    if (!form.name.trim()) return 'Name required'
    if (!selectableRoles.includes(form.role)) return 'Invalid role'
    if (!/^\d{13}$/.test(form.cnic)) return 'CNIC must be 13 digits'
    if (!/^\d{10,11}$/.test(form.phone)) return 'Phone must be 10-11 digits'
    if (form.password.length < 6) return 'Password must be at least 6 characters'
    return null
  }

  const submit = async (e) => {
    e.preventDefault()
    const err = validate()
    if (err) return toast.error(err)
    setLoading(true)
    try {
      const { data } = await api.post('/auth/signup-role', {
        role: form.role,
        name: form.name.trim(),
        cnic: form.cnic,
        phone: form.phone,
        password: form.password
      })
      setSubmittedInfo({
        pendingId: data.pendingId,
        badgeNumber: data.badgeNumber,
        role: form.role,
        name: form.name.trim()
      })
      toast.success('Request submitted for approval')
      setStep(3)
      // Auto redirect after short delay
      setTimeout(() => navigate('/login?switch=1', { replace: true }), 3000)
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-hero-grid">
      <div className="w-full max-w-xl animate-fadeLift">
        <div className="text-center mb-10 space-y-4">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-greenbrand-primary flex items-center justify-center shadow-soft">
            <ShieldCheckIcon className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">
            Create Administrative / LEO Account
          </h1>
          <p className="text-sm text-base-muted max-w-md mx-auto">
            Submit your details. Your access becomes active after System Admin approval.
          </p>
        </div>

        <div className="card p-8">
          <div className="flex justify-between mb-8">
            {steps.map(s => {
              const state = step === s.key ? 'active' : step > s.key ? 'complete' : 'pending'
              return (
                <div key={s.key} className="flex flex-col items-center text-[11px] font-medium">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center
                    ${state === 'active'
                      ? 'bg-greenbrand-primary text-white shadow-soft'
                      : state === 'complete'
                        ? 'bg-semantic-success text-white'
                        : 'bg-base-panelAlt text-base-muted border border-base-border'}`}>
                    {state === 'complete' ? <CheckCircleIcon className="h-6 w-6" /> : s.key}
                  </div>
                  <span className={`mt-2 uppercase tracking-wide ${state === 'active' ? 'text-base-text' : 'text-base-muted'}`}>{s.title}</span>
                </div>
              )
            })}
          </div>

          {step === 1 && (
            <form onSubmit={(e)=>{e.preventDefault(); setStep(2)}} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="input-group">
                  <label className="input-label">Full Name</label>
                  <div className="relative">
                    <UserIcon className="input-inline-icon" />
                    <input
                      name="name"
                      value={form.name}
                      onChange={onChange}
                      className="input-base pl-10"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Role</label>
                  <div className="relative">
                    <IdentificationIcon className="input-inline-icon" />
                    <select
                      name="role"
                      value={form.role}
                      onChange={onChange}
                      className="input-base pl-10"
                    >
                      {selectableRoles.map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">CNIC (13 digits)</label>
                  <div className="relative">
                    <IdentificationIcon className="input-inline-icon" />
                    <input
                      name="cnic"
                      value={form.cnic}
                      onChange={onChange}
                      className="input-base pl-10"
                      placeholder="1234567890123"
                    />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Phone (10-11 digits)</label>
                  <div className="relative">
                    <PhoneIcon className="input-inline-icon" />
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={onChange}
                      className="input-base pl-10"
                      placeholder="03XXXXXXXXX"
                    />
                  </div>
                </div>
                <div className="input-group md:col-span-2">
                  <label className="input-label">Password</label>
                  <div className="relative">
                    <LockClosedIcon className="input-inline-icon" />
                    <input
                      name="password"
                      type="password"
                      value={form.password}
                      onChange={onChange}
                      className="input-base pl-10"
                      placeholder="Min 6 characters"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={()=>navigate('/login')}
                >Cancel</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >Continue</button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={submit} className="space-y-6">
              <div className="p-4 rounded-xl bg-base-panelAlt/50 border border-base-border text-sm">
                <p className="mb-2"><strong>Review Details:</strong></p>
                <ul className="space-y-1 text-xs text-base-muted">
                  <li>Name: <span className="text-base-text">{form.name || '-'}</span></li>
                  <li>Role: <span className="text-base-text">{ROLE_LABELS[form.role]}</span></li>
                  <li>CNIC: <span className="text-base-text">{form.cnic || '-'}</span></li>
                  <li>Phone: <span className="text-base-text">{form.phone || '-'}</span></li>
                </ul>
                <p className="mt-4 text-xs text-base-muted">
                  Submitting will create a pending request. System Admin must approve before you can log in.
                </p>
                {form.role === ROLES.OFFICER && (
                  <p className="mt-2 text-xs text-greenbrand-light">
                    A unique 4-digit badge number will be assigned automatically upon submission.
                  </p>
                )}
              </div>
              <div className="flex justify-between gap-3">
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  onClick={()=>setStep(1)}
                >Back</button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`btn btn-primary w-full ${loading ? 'btn-disabled' : ''}`}
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          )}

          {step === 3 && submittedInfo && (
            <div className="space-y-6 text-center">
              <div className="h-20 w-20 mx-auto rounded-full bg-greenbrand-primary/25 flex items-center justify-center">
                <CheckCircleIcon className="h-12 w-12 text-greenbrand-light" />
              </div>
              <h2 className="text-lg font-semibold">Request Submitted</h2>
              <p className="text-sm text-base-muted max-w-sm mx-auto">
                Waiting for approval from System Admin.
              </p>
              {submittedInfo.role === ROLES.OFFICER && submittedInfo.badgeNumber && (
                <p className="text-sm">
                  Temporary Badge Assigned: <strong>{submittedInfo.badgeNumber}</strong>
                </p>
              )}
              <Link to="/login" className="btn btn-secondary w-full">
                Go to Login
              </Link>
            </div>
          )}
        </div>

        <div className="mt-10 text-center text-xs text-base-muted">
          Already have an approved account?{' '}
          <Link
            to="/login"
            className="text-greenbrand-light hover:text-greenbrand-primary transition font-medium"
          >
            Login here
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Signup