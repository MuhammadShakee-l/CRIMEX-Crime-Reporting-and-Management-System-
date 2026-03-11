import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ROLES, ROLE_LABELS } from '../utils/constants'
import {
  HomeIcon,
  FolderOpenIcon,
  RectangleGroupIcon,
  ShieldCheckIcon,
  ClipboardDocumentCheckIcon,
  UsersIcon,
  UserPlusIcon,
  ChartBarIcon,
  MapIcon,
  MagnifyingGlassCircleIcon,
  BeakerIcon,
  FingerPrintIcon,
  ShieldExclamationIcon,
  InboxArrowDownIcon,
} from '@heroicons/react/24/outline'

const Sidebar = ({ open }) => {
  const { user, profile } = useAuth()
  if (!user) return null

  const linkBase = 'nav-link'
  const linkActive = 'nav-link nav-link-active'

  // Get role from profile (Supabase) instead of user
  const userRole = profile?.role

  const officerLinks = [
    { to: '/officer/dashboard', label: `${ROLE_LABELS[ROLES.OFFICER]} Dashboard`, icon: HomeIcon },
    { to: '/officer/cases', label: 'My Cases', icon: FolderOpenIcon },
    { to: '/officer/background', label: 'Search Criminal Background', icon: MagnifyingGlassCircleIcon },
    { to: '/officer/face-search', label: 'Face Recognition Search', icon: FingerPrintIcon },
    { to: '/officer/behavior', label: 'Analyze Behavioral Patterns', icon: BeakerIcon },
    { to: '/officer/hotspot', label: 'Crime Hotspot Map', icon: MapIcon }
  ]
  const stationLinks = [
    { to: '/station/dashboard', label: `${ROLE_LABELS[ROLES.STATION_ADMIN]} Dashboard`, icon: HomeIcon },
    { to: '/station/assign', label: 'Unassigned Cases', icon: RectangleGroupIcon },
    { to: '/station/assigned', label: 'Assigned Cases', icon: ClipboardDocumentCheckIcon },
    { to: '/station/leos', label: 'LEOs', icon: ShieldCheckIcon },
    { to: '/station/analytics', label: 'Case Analytics', icon: ChartBarIcon },
    { to: '/station/hotspot', label: 'View Hotspot', icon: MapIcon },
    { to: '/station/face-search', label: 'Face Recognition Search', icon: FingerPrintIcon },
    { to: '/station/patterns', label: 'Pattern Analysis', icon: BeakerIcon },
    { to: '/station/requests', label: 'Received Requests', icon: InboxArrowDownIcon },
  ]
  const adminLinks = [
    { to: '/admin/dashboard', label: `${ROLE_LABELS[ROLES.SYS_ADMIN]} Dashboard`, icon: HomeIcon },
    { to: '/admin/users', label: 'Users', icon: UsersIcon },
    { to: '/admin/users/add', label: 'Add User', icon: UserPlusIcon },
    { to: '/admin/criminals', label: 'Criminal Records', icon: ShieldExclamationIcon },
  ]

  const links =
    userRole === ROLES.OFFICER ? officerLinks :
    userRole === ROLES.STATION_ADMIN ? stationLinks :
    userRole === ROLES.SYS_ADMIN ? adminLinks : []

  return (
    <aside className={`sidebar ${open ? 'block' : 'hidden'} md:block`}>
      <div className="sidebar-header">
        <div className="sidebar-header-logo">
          <ShieldCheckIcon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">CRIMEX</p>
          <p className="text:[10px] uppercase text-base-muted -mt-0.5">Secure CMS</p>
        </div>
      </div>
      <div className="sidebar-nav">
        {links.map(l => {
          const Icon = l.icon
          return (
            <NavLink
              end
              key={l.to}
              to={l.to}
              className={({ isActive }) => isActive ? linkActive : linkBase}
            >
              <Icon className="h-5 w-5" />
              <span>{l.label}</span>
            </NavLink>
          )
        })}
      </div>
    </aside>
  )
}

export default Sidebar