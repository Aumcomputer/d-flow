import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom'
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
import SocialWorkPage from './pages/SocialWorkPage'
import SettingsPage from './pages/SettingsPage'
import Navbar from './components/Navbar'
import { Lock } from 'lucide-react'
import { Button } from './components/ui/button'

const ProtectedRoute = ({ children, module, requireAdmin = false }) => {
  const { user, isAuthenticated, loading } = useAuth()
  if (loading) return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />

  // Admin Only Check
  if (requireAdmin && !user?.isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="pt-16 min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">เฉพาะผู้ดูแลระบบ (Admin Only)</h2>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              คุณไม่มีสิทธิ์เข้าถึงหน้านี้ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถจัดการตั้งค่าระบบได้
            </p>
            <Link to="/">
              <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
                กลับหน้าหลัก
              </Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // Module Permission Check (Admin can access all modules)
  if (module && !user?.isAdmin && !user?.allowedModules?.includes(module)) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="pt-16 min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">ไม่มีสิทธิ์เข้าถึงโมดูลนี้</h2>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              กลุ่มงานของคุณ {user?.groupname ? `(${user.groupname})` : ''} ไม่ได้รับสิทธิ์เข้าใช้งานโมดูลนี้ กรุณาติดต่อผู้ดูแลระบบ (Admin) เพื่อขอสิทธิ์การใช้งาน
            </p>
            <Link to="/">
              <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
                กลับหน้าหลัก
              </Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-16 min-h-screen">
        {children}
      </main>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><WelcomePage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute requireAdmin><SettingsPage /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute module="documents"><DocumentsPage /></ProtectedRoute>} />
      <Route path="/pttype" element={<ProtectedRoute module="pttype"><PttypePage /></ProtectedRoute>} />
      <Route path="/ward" element={<ProtectedRoute module="ward"><WardPage /></ProtectedRoute>} />
      <Route path="/dcdetail/:an" element={<ProtectedRoute><DischargeDetailPage /></ProtectedRoute>} />
      <Route path="/pharmacy" element={<ProtectedRoute module="pharmacy"><PharmacyPage /></ProtectedRoute>} />
      <Route path="/discharge" element={<ProtectedRoute module="discharge"><DischargeCenterPage /></ProtectedRoute>} />
      <Route path="/finance" element={<ProtectedRoute module="finance"><FinancePage /></ProtectedRoute>} />
      <Route path="/social-work" element={<ProtectedRoute module="social_work"><SocialWorkPage /></ProtectedRoute>} />
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
