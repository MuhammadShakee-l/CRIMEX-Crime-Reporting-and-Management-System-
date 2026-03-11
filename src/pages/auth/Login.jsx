import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../../contexts/AuthContext'
import { ROLES, ROLE_LABELS } from '../../utils/constants'
import { ShieldCheckIcon } from '@heroicons/react/24/outline'

/*
  Sign In flows:
  - System Admin: CNIC + Password
  - Station Admin: Badge + Password
  - LEO: Badge + Password

  Update:
  - Removed the "Forgot password?" link entirely.
*/

const tabs = [
  { key: 'SYS', label: `${ROLE_LABELS[ROLES.SYS_ADMIN]} (CNIC)` },
  { key: 'BADGE', label: 'Badge Login (LEO / Station Admin)' }
]

const Login = () => {
  const [tab, setTab] = useState('SYS')
  const [form, setForm] = useState({ cnic: '', password: '', badgeNumber: '' })
  const { login, user, profile, isLoggingIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname

  // If already logged in with profile, redirect immediately using Navigate component
  if (user && profile) {
    let target = '/login'
    if (profile.role === ROLES.OFFICER) target = '/officer/dashboard'
    else if (profile.role === ROLES.STATION_ADMIN) target = '/station/dashboard'
    else if (profile.role === ROLES.SYS_ADMIN) target = '/admin/dashboard'
    return <Navigate to={from || target} replace />
  }

  const onChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const validate = () => {
    if (tab === 'SYS') {
      if (!/^\d{13}$/.test(form.cnic)) return 'CNIC must be 13 digits'
      if (!form.password) return 'Password is required'
    } else {
      if (!/^\d{4}$/.test(form.badgeNumber)) return 'Badge number must be 4 digits'
      if (!form.password) return 'Password is required'
    }
    return null
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const err = validate()
    if (err) return toast.error(err)
    try {
      console.log('Starting login...')
      let result
      if (tab === 'SYS') {
        result = await login({ cnic: form.cnic, password: form.password })
      } else {
        result = await login({ badgeNumber: form.badgeNumber, password: form.password })
      }
      console.log('Login completed, result:', result)
      toast.success('Signed in successfully')
    } catch (error) {
      console.error('Login error:', error)
      toast.error(error?.message || 'Sign in failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-hero-grid">
      <div className="w-full max-w-md animate-fadeLift space-y-8">
        <div className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-greenbrand-primary flex items-center justify-center shadow-soft">
            <ShieldCheckIcon className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Sign In</h1>
          <p className="text-base-muted text-sm">Choose sign-in method based on role.</p>
        </div>

        <div className="flex rounded-2xl overflow-hidden border border-base-border bg-base-panelAlt">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-sm font-medium transition ${
                tab === t.key
                  ? 'bg-greenbrand-primary text-white'
                  : 'text-base-muted hover:bg-base-panel'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="card p-6 space-y-5">
          {tab === 'SYS' ? (
            <div>
              <label className="input-label">CNIC (13 digits)</label>
              <input
                name="cnic"
                value={form.cnic}
                onChange={onChange}
                className="input-base"
                placeholder="1234567890123"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="input-label">Badge Number (LEO/Station Admin)</label>
                <input
                  name="badgeNumber"
                  value={form.badgeNumber}
                  onChange={onChange}
                  className="input-base"
                  placeholder="1001"
                />
              </div>
              <p className="text-xs text-base-muted">
                Station Admin and LEO sign in using badge number and password.
              </p>
            </>
          )}
          <div>
            <label className="input-label">Password</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              className="input-base"
              placeholder="••••••"
            />
          </div>
          <button
            className={`btn btn-primary w-full ${isLoggingIn ? 'btn-disabled' : ''}`}
            disabled={isLoggingIn}
            type="submit"
          >
            {isLoggingIn ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login