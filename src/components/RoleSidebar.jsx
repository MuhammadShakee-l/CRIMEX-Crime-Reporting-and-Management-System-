import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ROLES, ROLE_LABELS } from '../utils/constants'

const NavItem = ({ to, label }) => {
  const { pathname } = useLocation()
  const active = pathname === to
  return (
    <li className={`nav-item ${active ? 'active' : ''}`}>
      <Link to={to}>{label}</Link>
    </li>
  )
}

const RoleSidebar = () => {
  const { user, profile } = useAuth()
  if (!user) return null

  // Get role from profile (Supabase) instead of user
  const userRole = profile?.role

  if (userRole === ROLES.OFFICER) {
    return (
      <ul className="nav">
        <NavItem to="/officer/dashboard" label={`${ROLE_LABELS[ROLES.OFFICER]} Dashboard`} />
        <NavItem to="/officer/cases" label="My Cases" />
      </ul>
    )
  }
  if (userRole === ROLES.STATION_ADMIN) {
    return (
      <ul className="nav">
        <NavItem to="/station/dashboard" label={`${ROLE_LABELS[ROLES.STATION_ADMIN]} Dashboard`} />
        <NavItem to="/station/assign" label="Unassigned Cases" />
      </ul>
    )
  }
  if (userRole === ROLES.SYS_ADMIN) {
    return (
      <ul className="nav">
        <NavItem to="/admin/dashboard" label={`${ROLE_LABELS[ROLES.SYS_ADMIN]} Dashboard`} />
        <NavItem to="/admin/users" label="Users" />
        <NavItem to="/admin/users/add" label="Add User" />
      </ul>
    )
  }
  return null
}

export default RoleSidebar