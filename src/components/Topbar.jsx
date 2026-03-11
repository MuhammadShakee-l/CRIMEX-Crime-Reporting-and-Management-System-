import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_LABELS } from '../utils/constants'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'

const Topbar = ({ toggleSidebar }) => {
  const { user, profile, logout } = useAuth()
  return (
    <div className="topbar">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="btn btn-ghost px-3 py-2 hidden md:inline-flex"
          title="Toggle Sidebar"
        >
          ☰
        </button>
        <h2 className="text-lg font-display font-semibold tracking-tight">
          {user ? 'CRIMEX Console' : 'CRIMEX'}
        </h2>
      </div>
      {user && (
        <div className="flex items-center gap-6">
          <div className="flex flex-col text-right">
            <span className="text-sm font-medium">{profile?.full_name || user.email}</span>
            <span className="text-[11px] text-base-muted uppercase tracking-wide">
              {ROLE_LABELS[profile?.role] || profile?.role || 'AUTHENTICATED'}
            </span>
          </div>
          <button
            onClick={logout}
            className="btn btn-danger btn-sm"
            title="Logout"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default Topbar