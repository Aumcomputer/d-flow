import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { User, Lock, ClipboardList } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'เข้าสู่ระบบไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="glass w-full max-w-md p-8 rounded-2xl animate-fade-in shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
        
        <div className="flex flex-col mb-8 w-full">
          <div className="flex justify-center w-full">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="40 20 270 90" className="w-full">
              <g transform="translate(60, 75)">
                <circle cx="20" cy="0" r="18" fill="none" stroke="#0f172a" strokeWidth="8"/>
                <line x1="38" y1="-30" x2="38" y2="18" stroke="#0f172a" strokeWidth="8" strokeLinecap="round"/>
                <line x1="50" y1="0" x2="75" y2="0" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round"/>
                <line x1="88" y1="0" x2="100" y2="0" stroke="#10b981" strokeWidth="8" strokeLinecap="round"/>
              </g>
              <text x="170" y="90" fontFamily="'Segoe UI', Roboto, sans-serif" fontWeight="900" fontSize="56" fill="#0f172a" fontStyle="italic">flow</text>
            </svg>
          </div>
          <div className="text-right mt-[-10px] sm:pr-2">
            <span className="font-semibold text-[11px] text-slate-500 tracking-[0.2em]">
              DISCHARGE MANAGEMENT SYSTEM
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">ชื่อผู้ใช้งาน</Label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-10"
                placeholder="Username"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive font-medium bg-red-50 p-3 rounded-md">{error}</p>}

          <Button type="submit" className="w-full text-md py-6 rounded-xl" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </Button>
        </form>
      </div>
    </div>
  )
}
