import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import { Button } from './ui/button'
import { LogOut, UserCircle, Volume2, VolumeX, RefreshCw } from 'lucide-react'
import { APP_VERSION, getVersionStatus, subscribeVersion, performReload } from '../services/version'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { isSoundEnabled, toggleSound } = useSound()
  const navigate = useNavigate()
  const [versionStatus, setVersionStatus] = useState(getVersionStatus())

  useEffect(() => {
    return subscribeVersion((status) => {
      setVersionStatus({ ...status })
    })
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 z-50 shadow-sm">
      <div className="w-full h-full px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center transition-opacity hover:opacity-80">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="40 10 270 115" className="h-10 w-auto">
              <g transform="translate(60, 75)">
                <circle cx="20" cy="0" r="18" fill="none" stroke="#0f172a" strokeWidth="8"/>
                <line x1="38" y1="-30" x2="38" y2="18" stroke="#0f172a" strokeWidth="8" strokeLinecap="round"/>
                <line x1="50" y1="0" x2="75" y2="0" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round"/>
                <line x1="88" y1="0" x2="100" y2="0" stroke="#10b981" strokeWidth="8" strokeLinecap="round"/>
              </g>
              <text x="170" y="90" fontFamily="'Segoe UI', Roboto, sans-serif" fontWeight="900" fontSize="56" fill="#0f172a" fontStyle="italic">flow</text>
              <text x="173" y="115" fontFamily="'Segoe UI', Roboto, sans-serif" fontWeight="600" fontSize="13" fill="#64748b" letterSpacing="1.5">DISCHARGE MANAGEMENT SYSTEM</text>
            </svg>
          </Link>

          {/* Version Badge beside logo */}
          <div 
            onClick={versionStatus.hasNewVersion ? performReload : undefined}
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium transition-all ${
              versionStatus.hasNewVersion 
                ? 'bg-amber-100 text-amber-900 border border-amber-300 cursor-pointer shadow-xs hover:bg-amber-200 animate-pulse' 
                : 'bg-slate-100/90 text-slate-500 border border-slate-200/80 select-none'
            }`}
            title={versionStatus.hasNewVersion 
              ? `ตรวจพบเวอร์ชันใหม่ (v${versionStatus.latestServerVersion}) คลิกเพื่ออัปเดตทันที` 
              : `เวอร์ชันปัจจุบัน: v${APP_VERSION}`}
          >
            <span>v{APP_VERSION}</span>
            {versionStatus.hasNewVersion && (
              <span className="flex items-center gap-1 text-[10px] text-amber-800 font-bold bg-amber-200/80 px-1.5 py-0.2 rounded-full">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                อัปเดต
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6">

          <div className="flex items-center gap-4">
            <button 
              onClick={toggleSound}
              className={`p-2 rounded-full transition-colors ${isSoundEnabled ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-slate-400 bg-slate-50 hover:bg-slate-100'}`}
              title={isSoundEnabled ? "ปิดเสียงแจ้งเตือน" : "เปิดเสียงแจ้งเตือน"}
            >
              {isSoundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2 text-slate-600 font-medium bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
              <UserCircle className="w-5 h-5 text-slate-400" />
              {user?.name || user?.loginname}
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full px-4">
              <LogOut className="w-4 h-4 mr-2" />
              ออกจากระบบ
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
