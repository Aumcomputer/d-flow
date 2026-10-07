import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { FileText, ShieldCheck, Building2, Pill, ClipboardList, Wallet, ChevronRight, Lock, HeartHandshake } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'

const modules = [
  { key: 'documents', path: '/documents', name: 'เวชระเบียน', desc: 'จัดการเอกสารผู้ป่วยใน', icon: FileText, color: 'from-blue-500 to-indigo-500', bg: 'bg-blue-50', text: 'text-blue-600' },
  { key: 'pttype', path: '/pttype', name: 'งานสิทธิ์', desc: 'ข้อมูลสิทธิผู้ป่วย', icon: ShieldCheck, color: 'from-sky-400 to-cyan-500', bg: 'bg-sky-50', text: 'text-sky-600' },
  { key: 'ward', path: '/ward', name: 'หอผู้ป่วย', desc: 'ข้อมูลหอผู้ป่วย', icon: Building2, color: 'from-teal-400 to-emerald-500', bg: 'bg-teal-50', text: 'text-teal-600' },
  { key: 'pharmacy', path: '/pharmacy', name: 'ห้องยา', desc: 'ระบบห้องยา', icon: Pill, color: 'from-green-400 to-emerald-600', bg: 'bg-green-50', text: 'text-green-600' },
  { key: 'discharge', path: '/discharge', name: 'ศูนย์จำหน่าย', desc: 'ศูนย์จำหน่ายผู้ป่วย', icon: ClipboardList, color: 'from-orange-400 to-amber-500', bg: 'bg-orange-50', text: 'text-orange-600' },
  { key: 'finance', path: '/finance', name: 'การเงิน', desc: 'ระบบการเงิน', icon: Wallet, color: 'from-purple-500 to-fuchsia-500', bg: 'bg-purple-50', text: 'text-purple-600' },
  { key: 'social_work', path: '/social-work', name: 'สังคมสงเคราะห์', desc: 'ระบบสังคมสงเคราะห์', icon: HeartHandshake, color: 'from-rose-500 to-pink-500', bg: 'bg-rose-50', text: 'text-rose-600' },
]

export default function WelcomePage() {
  const { user } = useAuth()
  const date = new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="w-full px-6 lg:px-10 py-5 animate-fade-in relative z-10 flex flex-col">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-5 border-slate-200">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-2">สวัสดี, {user?.name}</h1>
          <p className="text-slate-500 font-medium">
            ยินดีต้อนรับสู่ระบบ D-Flow : Hospital Discharge Management System
            {user?.groupname && (
              <span className="ml-2 inline-block px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-normal">
                กลุ่ม: {user.groupname}
              </span>
            )}
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-3">
          <div className="text-slate-600 bg-white px-4 py-2 rounded-full shadow-2xs border border-slate-100 text-sm font-medium">
            {date}
          </div>
        </div>
      </div>

      <div className="mt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-5">
          {modules.map((m) => {
            const isAllowed = user?.isAdmin || (Array.isArray(user?.allowedModules) && user.allowedModules.includes(m.key))

            if (!isAllowed) {
              return (
                <div key={m.path} className="block cursor-not-allowed opacity-55 select-none" title="คุณไม่มีสิทธิ์เข้าถึงโมดูลนี้ กรุณาติดต่อ Admin">
                  <Card className="glass-card h-full border border-dashed border-slate-300 overflow-hidden relative rounded-2xl bg-slate-50/70">
                    <CardContent className="p-5 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-5">
                        <div className={`p-3.5 rounded-2xl bg-slate-200 text-slate-400 shadow-2xs`}>
                          <m.icon className="w-7 h-7" />
                        </div>
                        <div className="bg-slate-200/80 p-2 rounded-full text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                      </div>
                      <h3 className="text-2xl sm:text-[26px] font-bold text-slate-500 mb-2 leading-tight tracking-tight">{m.name}</h3>
                      <p className="text-slate-400 text-xs mt-auto">ไม่มีสิทธิ์เข้าใช้งาน</p>
                    </CardContent>
                  </Card>
                </div>
              )
            }

            return (
              <Link key={m.path} to={m.path} className="group block">
                <Card className="glass-card h-full border-none overflow-hidden relative rounded-2xl group-hover:-translate-y-1 duration-300 shadow-sm hover:shadow-md transition-all">
                  <div className={`absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b ${m.color}`}></div>
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-5">
                      <div className={`p-3.5 rounded-2xl ${m.bg} ${m.text} shadow-2xs group-hover:scale-110 transition-transform duration-300`}>
                        <m.icon className="w-7 h-7" />
                      </div>
                      <div className="bg-slate-50 p-2 rounded-full group-hover:bg-slate-100 transition-colors">
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                      </div>
                    </div>
                    <h3 className="text-2xl sm:text-[26px] font-bold text-slate-800 mb-2 leading-tight tracking-tight">{m.name}</h3>
                    <p className="text-slate-500 text-sm font-medium mt-auto leading-relaxed">{m.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
