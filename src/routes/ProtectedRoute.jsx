import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ProtectedRoute = ({ allowedRoles }) => {
  const { user, profile, authReady } = useAuth()
  const location = useLocation()

  // Wait for auth to be ready
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-base-muted text-sm">
        Authenticating...
      </div>
    )
  }

  // Not logged in - redirect to login
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // User logged in but profile not loaded yet - wait
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-base-muted text-sm">
        Loading profile...
      </div>
    )
  }

  // Check role-based access (role is in profile, not user)
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute