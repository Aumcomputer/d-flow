import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'
import socket from '../services/socket'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me')
      if (res.data?.user) {
        setUser(res.data.user)
      }
    } catch (error) {
      // ignore
    }
  }

  useEffect(() => {
    const initAuth = async () => {
      try {
        const res = await api.get('/auth/me')
        setUser(res.data.user)
      } catch (error) {
        // Not authenticated, ignore
      } finally {
        setLoading(false)
      }
    }
    initAuth()

    socket.on('settings:permissions_updated', refreshUser)
    socket.on('settings:admins_updated', refreshUser)

    return () => {
      socket.off('settings:permissions_updated', refreshUser)
      socket.off('settings:admins_updated', refreshUser)
    }
  }, [])

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password })
    setUser(res.data.user)
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (e) {
      console.error('Logout failed', e)
    } finally {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

