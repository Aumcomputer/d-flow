import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SoundProvider } from './contexts/SoundContext'
import socket from './services/socket'
import LoginPage from './pages/LoginPage'
import WelcomePage from './pages/WelcomePage'
import DocumentsPage from './pages/DocumentsPage'
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
      <Route path="/ward" element={<ProtectedRoute><WardPage /></ProtectedRoute>} />
      <Route path="/dcdetail/:an" element={<ProtectedRoute><DischargeDetailPage /></ProtectedRoute>} />
      <Route path="/pharmacy" element={<ProtectedRoute><PharmacyPage /></ProtectedRoute>} />
      <Route path="/discharge" element={<ProtectedRoute><DischargeCenterPage /></ProtectedRoute>} />
      <Route path="/finance" element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />
    </Routes>
  )
}

function App() {
  useEffect(() => {
    const handleForceRefresh = () => {
      alert('มีการอัปเดตระบบเวอร์ชันใหม่ ระบบจะทำการรีเฟรชหน้าจอ')
      window.location.reload(true)
    }

    socket.on('system:force_refresh', handleForceRefresh)

    return () => {
      socket.off('system:force_refresh', handleForceRefresh)
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
