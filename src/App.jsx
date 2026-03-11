import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import { ROLES } from './utils/constants'
import ProtectedRoute from './routes/ProtectedRoute'

/* Public / Auth */
import Homepage from './pages/public/Homepage'
import Login from './pages/auth/Login'

/* Officer (LEO) */
import OfficerDashboard from './pages/officer/Dashboard'
import OfficerCasesList from './pages/officer/CasesList'
import OfficerCaseDetail from './pages/officer/CaseDetail'
import OfficerBehavior from './pages/officer/BehaviorPatterns'
import OfficerBackgroundSearch from './pages/officer/BackgroundSearch'

/* Station Admin */
import StationDashboard from './pages/station/Dashboard'
import UnassignedCases from './pages/station/UnassignedCases'
import AssignedCases from './pages/station/AssignedCases'
import StationLeos from './pages/station/StationLeos'
import StationCaseDetail from './pages/station/CaseDetail'
import CaseAnalytics from './pages/station/CaseAnalytics'
import StationHotspot from './pages/station/Hotspot'
import StationPatternAnalysis from './pages/station/PatternAnalysis'
import ReceivedRequests from './pages/station/ReceivedRequests'

/* Shared */
import FaceSearch from './pages/shared/FaceSearch'

/* System Admin */
import AdminDashboard from './pages/admin/Dashboard'
import UsersList from './pages/admin/UsersList'
import AddUser from './pages/admin/AddUser'
import CriminalRecords from './pages/admin/CriminalRecords'

function App() {
  return (
    <>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Homepage />} />
        <Route path="/login" element={<Login />} />

        {/* Officer */}
        <Route element={<ProtectedRoute allowedRoles={[ROLES.OFFICER]} />}>
          <Route path="/officer/dashboard" element={<OfficerDashboard />} />
          <Route path="/officer/cases" element={<OfficerCasesList />} />
          <Route path="/officer/case/:id" element={<OfficerCaseDetail />} />
          <Route path="/officer/behavior" element={<OfficerBehavior />} />
          <Route path="/officer/background" element={<OfficerBackgroundSearch />} />
          <Route path="/officer/face-search" element={<FaceSearch />} />
          <Route path="/officer/hotspot" element={<StationHotspot />} />
        </Route>

        {/* Station Admin */}
        <Route element={<ProtectedRoute allowedRoles={[ROLES.STATION_ADMIN]} />}>
          <Route path="/station/dashboard" element={<StationDashboard />} />
          <Route path="/station/assign" element={<UnassignedCases />} />
          <Route path="/station/assigned" element={<AssignedCases />} />
          <Route path="/station/leos" element={<StationLeos />} />
          <Route path="/station/case/:id" element={<StationCaseDetail />} />
          <Route path="/station/analytics" element={<CaseAnalytics />} />
          <Route path="/station/hotspot" element={<StationHotspot />} />
          <Route path="/station/face-search" element={<FaceSearch />} />
          <Route path="/station/patterns" element={<StationPatternAnalysis />} />
          <Route path="/station/requests" element={<ReceivedRequests />} />
        </Route>

        {/* System Admin */}
        <Route element={<ProtectedRoute allowedRoles={[ROLES.SYS_ADMIN]} />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<UsersList />} />
          <Route path="/admin/users/add" element={<AddUser />} />
          <Route path="/admin/criminals" element={<CriminalRecords />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastContainer position="top-right" theme="dark" />
    </>
  )
}

export default App