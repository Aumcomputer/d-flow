import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SoundProvider } from './contexts/SoundContext'
import socket from './services/socket'
import { getVersionStatus, checkServerVersion, performReload } from './services/version'
import LoginPage from './pages/LoginPage'
import WelcomePage from './pages/WelcomePage'
import DocumentsPage from './pages/DocumentsPage'
import PttypePage from './pages/PttypePage'
import WardPage from './pages/WardPage'
import PharmacyPage from './pages/PharmacyPage'
import DischargeCenterPage from './pages/DischargeCenterPage'
import FinancePage from './pages/FinancePage'
import DischargeDetailPage from './pages/DischargeDetailPage'
import Navbar from './components/Navbar'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>
  return isAuthenticated ? (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-16 min-h-screen">
        {children}
      </main>
    </div>
  ) : (
    <Navigate to="/login" replace />
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><WelcomePage /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
      <Route path="/pttype" element={<ProtectedRoute><PttypePage /></ProtectedRoute>} />
      <Route path="/ward" element={<ProtectedRoute><WardPage /></ProtectedRoute>} />
      <Route path="/dcdetail/:an" element={<ProtectedRoute><DischargeDetailPage /></ProtectedRoute>} />
      <Route path="/pharmacy" element={<ProtectedRoute><PharmacyPage /></ProtectedRoute>} />
      <Route path="/discharge" element={<ProtectedRoute><DischargeCenterPage /></ProtectedRoute>} />
      <Route path="/finance" element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />
    </Routes>
  )
}

function App() {
  const location = useLocation()
  const previousPathRef = useRef(location.pathname)

  // Auto-refresh ONLY when route changes and a new version is detected
  useEffect(() => {
    if (previousPathRef.current !== location.pathname) {
      previousPathRef.current = location.pathname
      const { hasNewVersion } = getVersionStatus()
      if (hasNewVersion) {
        console.log('[VersionCheck] Route changed with new version detected. Refreshing page...')
        performReload()
      }
    }
  }, [location.pathname])

  useEffect(() => {
    const handleForceRefresh = () => {
      alert('มีการอัปเดตระบบเวอร์ชันใหม่ ระบบจะทำการรีเฟรชหน้าจอ')
      performReload()
    }

    const handleVersionBroadcast = (data) => {
      if (data?.version) {
        checkServerVersion(data.version)
      }
    }

    socket.on('system:force_refresh', handleForceRefresh)
    socket.on('system:version', handleVersionBroadcast)

    return () => {
      socket.off('system:force_refresh', handleForceRefresh)
      socket.off('system:version', handleVersionBroadcast)
    }
  }, [])

  return (
    <AuthProvider>
      <SoundProvider>
        <AppRoutes />
      </SoundProvider>
    </AuthProvider>
  )
}

export default App
