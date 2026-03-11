import { supabase } from '../lib/supabase'

/**
 * Authentication Service for CRIMEX Web Dashboard
 * Handles login for System Admin, Station Admin, and LEO users
 * 
 * UPDATED: Now uses direct table authentication (no Supabase Auth dependency)
 * Each role table stores its own credentials
 */

export const authService = {
  /**
   * Login with CNIC (System Admin only)
   * @param {string} cnic - 13 digit CNIC
   * @param {string} password - User password
   * @returns {Promise<{user, profile, role}>}
   */
  async loginWithCNIC(cnic, password) {
    try {
      console.log('loginWithCNIC started with CNIC:', cnic)
      
      // Get admin from system_admins table using CNIC
      const { data: adminData, error: adminError } = await supabase
        .from('system_admins')
        .select('*')
        .eq('cnic', cnic)
        .eq('is_active', true)
        .single()

      console.log('Admin query result:', { adminData, adminError })

      if (adminError || !adminData) {
        console.error('Admin lookup failed:', adminError)
        throw new Error('Invalid CNIC or user not found')
      }

      // Check password (direct comparison - in production use bcrypt)
      if (adminData.password_hash !== password) {
        console.error('Password mismatch')
        throw new Error('Invalid password')
      }

      console.log('Password verified, login successful!')

      // Update last login
      await supabase
        .from('system_admins')
        .update({ last_login: new Date().toISOString() })
        .eq('id', adminData.id)

      // Create a mock user object for compatibility
      const mockUser = {
        id: adminData.id,
        email: adminData.email,
        role: 'SYS_ADMIN'
      }

      console.log('Login successful!')

      return {
        user: mockUser,
        session: { user: mockUser },
        profile: adminData,
        role: 'SYS_ADMIN'
      }
    } catch (error) {
      console.error('Login with CNIC error:', error)
      throw error
    }
  },

  /**
   * Login with Badge Number (Station Admin or LEO)
   * @param {string} badgeNumber - 4 digit badge number
   * @param {string} password - User password
   * @returns {Promise<{user, profile, role}>}
   */
  async loginWithBadge(badgeNumber, password) {
    try {
      console.log('loginWithBadge started with badge:', badgeNumber)
      
      // Check if Station Admin
      let { data: stationAdminData, error: stationAdminError } = await supabase
        .from('station_admins')
        .select('*, police_stations(station_name, city, province)')
        .eq('badge_number', badgeNumber)
        .eq('is_active', true)
        .single()

      console.log('Station Admin query result:', { stationAdminData, stationAdminError })

      if (stationAdminData) {
        // Verify password directly
        if (stationAdminData.password_hash !== password) {
          console.error('Password mismatch for Station Admin')
          throw new Error('Invalid password')
        }

        console.log('Password verified for Station Admin!')

        // Update last login
        await supabase
          .from('station_admins')
          .update({ last_login: new Date().toISOString() })
          .eq('id', stationAdminData.id)

        const mockUser = {
          id: stationAdminData.id,
          email: stationAdminData.email,
          role: 'STATION_ADMIN'
        }

        return {
          user: mockUser,
          session: { user: mockUser },
          profile: stationAdminData,
          role: 'STATION_ADMIN'
        }
      }

      // Check if LEO
      let { data: leoData, error: leoError } = await supabase
        .from('law_enforcement_officers')
        .select('*, police_stations(station_name, city, province)')
        .eq('badge_number', badgeNumber)
        .eq('is_active', true)
        .single()

      console.log('LEO query result:', { leoData, leoError })

      if (leoData) {
        // Verify password directly
        if (leoData.password_hash !== password) {
          console.error('Password mismatch for LEO')
          throw new Error('Invalid password')
        }

        console.log('Password verified for LEO!')

        // Update last login
        await supabase
          .from('law_enforcement_officers')
          .update({ last_login: new Date().toISOString() })
          .eq('id', leoData.id)

        const mockUser = {
          id: leoData.id,
          email: leoData.email,
          role: 'OFFICER'
        }

        return {
          user: mockUser,
          session: { user: mockUser },
          profile: leoData,
          role: 'OFFICER'
        }
      }

      throw new Error('Invalid badge number or user not found')
    } catch (error) {
      console.error('Login with Badge error:', error)
      throw error
    }
  },

  /**
   * Get user profile based on role and ID
   * @param {string} id - User ID from role table
   * @param {string} role - User role (SYS_ADMIN, STATION_ADMIN, OFFICER)
   * @returns {Promise<{profile, role}>}
   */
  async getUserProfile(id, role) {
    try {
      console.log('getUserProfile called with id:', id, 'role:', role)
      
      if (role === 'SYS_ADMIN') {
        const { data: adminData, error } = await supabase
          .from('system_admins')
          .select('*')
          .eq('id', id)
          .eq('is_active', true)
          .single()

        if (adminData) {
          return { profile: adminData, role: 'SYS_ADMIN' }
        }
      }

      if (role === 'STATION_ADMIN') {
        const { data: stationAdminData, error } = await supabase
          .from('station_admins')
          .select('*, police_stations(station_name, city, province)')
          .eq('id', id)
          .eq('is_active', true)
          .single()

        if (stationAdminData) {
          return { profile: stationAdminData, role: 'STATION_ADMIN' }
        }
      }

      if (role === 'OFFICER') {
        const { data: leoData, error } = await supabase
          .from('law_enforcement_officers')
          .select('*, police_stations(station_name, city, province)')
          .eq('id', id)
          .eq('is_active', true)
          .single()

        if (leoData) {
          return { profile: leoData, role: 'OFFICER' }
        }
      }

      throw new Error('User profile not found')
    } catch (error) {
      console.error('Get user profile error:', error)
      throw error
    }
  },

  /**
   * Logout user - clears local session
   */
  async logout() {
    try {
      localStorage.removeItem('crimex_session')
      localStorage.removeItem('crimex_user')
      localStorage.removeItem('crimex_profile')
      localStorage.removeItem('crimex_role')
    } catch (error) {
      console.error('Logout error:', error)
      throw error
    }
  },

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    try {
      const session = localStorage.getItem('crimex_session')
      return !!session
    } catch (error) {
      return false
    }
  },

  /**
   * Get current session from localStorage
   * @returns {Object|null}
   */
  getSession() {
    try {
      const session = localStorage.getItem('crimex_session')
      return session ? JSON.parse(session) : null
    } catch (error) {
      return null
    }
  },

  /**
   * Save session to localStorage
   */
  saveSession(user, profile, role) {
    localStorage.setItem('crimex_session', JSON.stringify({ user, profile, role }))
    localStorage.setItem('crimex_user', JSON.stringify(user))
    localStorage.setItem('crimex_profile', JSON.stringify(profile))
    localStorage.setItem('crimex_role', role)
  },

  /**
   * Get stored user data
   */
  getStoredUser() {
    try {
      const user = localStorage.getItem('crimex_user')
      const profile = localStorage.getItem('crimex_profile')
      const role = localStorage.getItem('crimex_role')
      
      if (user && profile && role) {
        return {
          user: JSON.parse(user),
          profile: JSON.parse(profile),
          role: role
        }
      }
      return null
    } catch (error) {
      return null
    }
  },

  /**
   * Create audit log entry (optional feature)
   * @param {Object} logData - Audit log data
   */
  async createAuditLog(logData) {
    try {
      await supabase
        .from('audit_logs')
        .insert({
          user_id: logData.user_id,
          user_role: logData.role?.toLowerCase() || 'unknown',
          user_name: logData.user_name || 'Unknown',
          action_type: logData.action_type,
          entity_type: logData.entity_type,
          entity_id: logData.entity_id || null,
          action_description: logData.action_description,
          old_value: logData.old_value || null,
          new_value: logData.new_value || null,
        })
    } catch (error) {
      console.error('Create audit log error:', error)
      // Don't throw error for audit logs to prevent disrupting main flow
    }
  },

  /**
   * Verify permissions
   * @param {string} role - User role
   * @param {string} permission - Permission to check
   * @returns {boolean}
   */
  hasPermission(role, permission) {
    if (role === 'SYS_ADMIN') {
      return true // System admins have all permissions
    }
    
    // Add role-based permission checks as needed
    return false
  }
}

export default authService
