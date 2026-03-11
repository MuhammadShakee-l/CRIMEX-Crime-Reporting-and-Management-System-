import React, { useState } from 'react'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheckIcon,
  UserIcon,
  IdentificationIcon,
  LockClosedIcon,
  KeyIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import { ROLES, ROLE_LABELS } from '../../utils/constants'

/*
  Multi-step Forgot Password flow:
  Step 1: Select Role
  Step 2: Enter Identifier (Badge for LEO, CNIC for others)
  Step 3: Confirm identity (show name -> user clicks Confirm)
  Step 4: Enter OTP (demo: 123456)
  Step 5: Reset Password
  Step 6: Success
*/

const steps = [
  { id: 1, title: 'Role' },
  { id: 2, title: 'Identity' },
  { id: 3, title: 'Confirm' },
  { id: 4, title: 'OTP' },
  { id: 5, title: 'Reset' },
  { id: 6, title: 'Done' }
]

const ForgotPassword = () => {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [foundUser, setFoundUser] = useState(null)
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const navigate = useNavigate()

  const roleLabel = role ? ROLE_LABELS[role] : ''

  const next = () => setStep(s => s + 1)
  const back = () => setStep(s => s - 1)

  const validateIdentity = () => {
    if (!role) return 'Select a role'
    if (role === ROLES.OFFICER) {
      if (!/^\d{3,}$/.test(identifier)) return 'Badge number must be numeric (≥3 digits)'
    } else {
      if (!/^\d{13}$/.test(identifier)) return 'CNIC must be 13 digits'
    }
    return null
  }

  const handleIdentify = async (e) => {
    e.preventDefault()
    const err = validateIdentity()
    if (err) return toast.error(err)
    setLoading(true)
    try {
      const { data } = await api.post('/auth/identify', {
        role,
        badgeNumber: role === ROLES.OFFICER ? identifier : undefined,
        cnic: role !== ROLES.OFFICER ? identifier : undefined
      })
      setFoundUser(data.user)
      toast.success('Identity found')
      next() // to confirmation
    } catch (error) {
      toast.error(error?.response?.data?.message || 'No record found')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmIdentity = () => {
    alert('Demo OTP: 123456')
    toast.info('OTP sent (demo)')
    next()
  }

  const handleVerifyOtp = (e) => {
    e.preventDefault()
    if (otp !== '123456') return toast.error('Invalid OTP (use 123456)')
    toast.success('OTP verified')
    next()
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (newPassword.length < 6) return toast.error('Password must be at least 6 characters')
    setLoading(true)
    try {
      // Single endpoint handles both; mock extended to accept badgeNumber or cnic
      await api.post('/auth/reset-flex', {
        role,
        badgeNumber: role === ROLES.OFFICER ? identifier : undefined,
        cnic: role !== ROLES.OFFICER ? identifier : undefined,
        password: newPassword
      })
      toast.success('Password reset')
      next()
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  const renderSteps = () => (
    <div className="flex justify-between mb-10">
      {steps.map(s => {
        const state =
          step === s.id ? 'active' :
          step > s.id ? 'complete' :
          'pending'
        return (
          <div key={s.id} className="flex flex-col items-center text-[11px] font-medium">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center
              ${state === 'active'
                ? 'bg-greenbrand-primary text-white shadow-soft'
                : state === 'complete'
                  ? 'bg-semantic-success text-white'
                  : 'bg-base-panelAlt text-base-muted border border-base-border'}`}>
              {state === 'complete' ? <CheckCircleIcon className="h-6 w-6" /> : s.id}
            </div>
            <span className={`mt-2 uppercase tracking-wide ${state === 'active' ? 'text-base-text' : 'text-base-muted'}`}>{s.title}</span>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-hero-grid">
      <div className="w-full max-w-xl animate-fadeLift">
        <div className="text-center mb-10 space-y-4">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-greenbrand-primary flex items-center justify-center shadow-soft">
            <ShieldCheckIcon className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">
            Recover Your Password
          </h1>
          <p className="text-sm text-base-muted max-w-md mx-auto">
            Follow the secure, role-based recovery process.
          </p>
        </div>

        <div className="card p-8">
          {renderSteps()}

          {step === 1 && (
            <form onSubmit={(e)=>{e.preventDefault(); if(!role) return toast.error('Select role'); next();}} className="space-y-6">
              <div className="input-group">
                <label className="input-label">Select Role</label>
                <div className="relative">
                  <UserIcon className="input-inline-icon" />
                  <select
                    value={role}
                    onChange={(e)=>setRole(e.target.value)}
                    className="input-base pl-10"
                  >
                    <option value="">Choose Role</option>
                    <option value={ROLES.OFFICER}>{ROLE_LABELS[ROLES.OFFICER]}</option>
                    <option value={ROLES.STATION_ADMIN}>{ROLE_LABELS[ROLES.STATION_ADMIN]}</option>
                    <option value={ROLES.SYS_ADMIN}>{ROLE_LABELS[ROLES.SYS_ADMIN]}</option>
                    <option value={ROLES.CITIZEN}>{ROLE_LABELS[ROLES.CITIZEN]}</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className={`btn btn-primary w-full ${!role ? 'btn-disabled' : ''}`}
                disabled={!role}
              >
                Continue
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleIdentify} className="space-y-6">
              <div className="input-group">
                <label className="input-label">
                  {role === ROLES.OFFICER ? 'Badge Number' : 'CNIC'}
                </label>
                <div className="relative">
                  <IdentificationIcon className="input-inline-icon" />
                  <input
                    value={identifier}
                    onChange={(e)=>setIdentifier(e.target.value)}
                    className="input-base pl-10"
                    placeholder={role === ROLES.OFFICER ? 'e.g. 1001' : '13 digits'}
                  />
                </div>
                <p className="text-xs text-base-muted mt-2">
                  Enter your {role === ROLES.OFFICER ? 'official badge number' : 'registered CNIC'}.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className={`btn btn-primary w-full ${loading ? 'btn-disabled' : ''}`}
                >
                  {loading ? 'Checking...' : 'Find Account'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  onClick={back}
                  disabled={loading}
                >
                  Back
                </button>
              </div>
            </form>
          )}

          {step === 3 && foundUser && (
            <div className="space-y-6">
              <div className="input-group">
                <label className="input-label">Confirm Identity</label>
                <div className="card p-4 flex items-center gap-4 bg-base-panelAlt/40">
                  <div className="h-12 w-12 rounded-xl bg-greenbrand-primary/20 flex items-center justify-center">
                    <UserIcon className="h-6 w-6 text-greenbrand-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{foundUser.name}</span>
                    <span className="text-xs text-base-muted">
                      {role === ROLES.OFFICER ? `Badge: ${foundUser.badgeNumber}` : `CNIC: ${foundUser.cnic}`}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-base-muted">
                If this is not you, go back and re-enter your {role === ROLES.OFFICER ? 'badge number' : 'CNIC'}.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  className="btn btn-primary w-full"
                  onClick={handleConfirmIdentity}
                >Confirm & Send OTP</button>
                <button
                  className="btn btn-secondary w-full"
                  onClick={back}
                >Back</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="input-group">
                <label className="input-label">Enter OTP</label>
                <div className="relative">
                  <KeyIcon className="input-inline-icon" />
                  <input
                    value={otp}
                    onChange={(e)=>setOtp(e.target.value)}
                    className="input-base pl-10 tracking-widest text-center font-mono"
                    placeholder="123456"
                  />
                </div>
                <p className="text-xs text-base-muted mt-2">Demo OTP is 123456</p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={!otp}
                  className={`btn btn-accent w-full ${!otp ? 'btn-disabled' : ''}`}
                >Verify OTP</button>
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  onClick={back}
                >Back</button>
              </div>
            </form>
          )}

          {step === 5 && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="input-group">
                <label className="input-label">New Password</label>
                <div className="relative">
                  <LockClosedIcon className="input-inline-icon" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e)=>setNewPassword(e.target.value)}
                    className="input-base pl-10"
                    placeholder="Min 6 characters"
                  />
                </div>
                <p className="text-xs text-base-muted mt-2">
                  Use a strong password (letters + numbers).
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading || newPassword.length < 6}
                  className={`btn btn-primary w-full ${(loading || newPassword.length < 6) ? 'btn-disabled' : ''}`}
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  onClick={back}
                  disabled={loading}
                >Back</button>
              </div>
            </form>
          )}

          {step === 6 && (
            <div className="flex flex-col items-center gap-6 py-6">
              <div className="h-20 w-20 rounded-full bg-greenbrand-primary/25 flex items-center justify-center">
                <CheckCircleIcon className="h-12 w-12 text-greenbrand-light" />
              </div>
              <h2 className="text-xl font-semibold">Password Updated</h2>
              <p className="text-sm text-base-muted text-center max-w-sm">
                Redirecting to login… Use your new password with your {role === ROLES.OFFICER ? 'badge number' : 'CNIC'}.
              </p>
            </div>
          )}
        </div>

        <div className="mt-10 text-center text-xs text-base-muted">
          Remembered it?{' '}
          <button
            onClick={()=>navigate('/login')}
            className="text-greenbrand-light hover:text-greenbrand-primary transition font-medium"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword