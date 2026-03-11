import React, { createContext, useContext, useEffect, useState } from 'react'
import authService from '../services/authService'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Initialize auth state from localStorage
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        // Check for existing session in localStorage
        const storedData = authService.getStoredUser()
        
        if (storedData && mounted) {
          console.log('Found stored session:', storedData)
          setUser(storedData.user)
          setProfile({ ...storedData.profile, role: storedData.role })
          setSession({ user: storedData.user })
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        if (mounted) {
          setAuthReady(true)
        }
      }
    }

    initializeAuth()

    return () => {
      mounted = false
    }
  }, [])

  const login = async (credentials) => {
    if (isLoggingIn) return
    
    setIsLoggingIn(true)
    try {
      let result

      // Login with CNIC (System Admin)
      if (credentials.cnic) {
        result = await authService.loginWithCNIC(credentials.cnic, credentials.password)
      }
      // Login with Badge (Station Admin or LEO)
      else if (credentials.badgeNumber) {
        result = await authService.loginWithBadge(credentials.badgeNumber, credentials.password)
      }
      else {
        throw new Error('Invalid login credentials')
      }

      // Save session to localStorage
      authService.saveSession(result.user, result.profile, result.role)

      setUser(result.user)
      setSession(result.session)
      setProfile({ ...result.profile, role: result.role })

      return result.profile
    } catch (error) {
      console.error('Login error:', error)
      throw error
    } finally {
      setIsLoggingIn(false)
    }
  }

  const logout = async () => {
    try {
      await authService.logout()
      setUser(null)
      setSession(null)
      setProfile(null)
    } catch (error) {
      console.error('Logout error:', error)
      throw error
    }
  }

  const hasPermission = (permission) => {
    if (!profile) return false
    if (profile.role === 'SYS_ADMIN') return true
    return profile.permissions?.[permission] === true
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      authReady,
      isLoggingIn,
      login,
      logout,
      hasPermission
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)