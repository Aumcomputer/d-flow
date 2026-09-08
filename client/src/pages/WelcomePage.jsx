import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { FileText, ShieldCheck, Building2, Pill, ClipboardList, Wallet, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'

const modules = [
  { path: '/documents', name: 'เวชระเบียน', desc: 'จัดการเอกสารผู้ป่วยใน', icon: FileText, color: 'from-blue-500 to-indigo-500', bg: 'bg-blue-50', text: 'text-blue-600' },
  { path: '/pttype', name: 'งานสิทธิ์', desc: 'ข้อมูลสิทธิผู้ป่วย', icon: ShieldCheck, color: 'from-sky-400 to-cyan-500', bg: 'bg-sky-50', text: 'text-sky-600' },
  { path: '/ward', name: 'หอผู้ป่วย', desc: 'ข้อมูลหอผู้ป่วย', icon: Building2, color: 'from-teal-400 to-emerald-500', bg: 'bg-teal-50', text: 'text-teal-600' },
  { path: '/pharmacy', name: 'ห้องยา', desc: 'ระบบห้องยา', icon: Pill, color: 'from-green-400 to-emerald-600', bg: 'bg-green-50', text: 'text-green-600' },
  { path: '/discharge', name: 'ศูนย์จำหน่าย', desc: 'ศูนย์จำหน่ายผู้ป่วย', icon: ClipboardList, color: 'from-orange-400 to-amber-500', bg: 'bg-orange-50', text: 'text-orange-600' },
  { path: '/finance', name: 'การเงิน', desc: 'ระบบการเงิน', icon: Wallet, color: 'from-purple-500 to-fuchsia-500', bg: 'bg-purple-50', text: 'text-purple-600' },
]

export default function WelcomePage() {
  const { user } = useAuth()
  const date = new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="container mx-auto p-6 w-full animate-fade-in relative z-10 flex flex-col h-full">
      <div className="mb-10 mt-4 flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-6 border-slate-200">
        <div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2">สวัสดี, {user?.name}</h1>
          <p className="text-slate-500 font-medium">ยินดีต้อนรับสู่ระบบ D-Flow : Hospital Discharge Management System</p>
        </div>
        <div className="mt-4 md:mt-0 text-slate-600 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
          {date}
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {modules.map((m, i) => (
          <Link key={m.path} to={m.path} className="group block">
            <Card className="glass-card h-full border-none overflow-hidden relative rounded-2xl group-hover:-translate-y-1 duration-300">
              <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${m.color}`}></div>
              <CardContent className="p-8 flex flex-col h-full">
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-4 rounded-2xl ${m.bg} ${m.text} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                    <m.icon className="w-8 h-8" />
                  </div>
                  <div className="bg-slate-50 p-2 rounded-full group-hover:bg-slate-100 transition-colors">
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">{m.name}</h3>
                <p className="text-slate-500 font-medium mt-auto">{m.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
     </div>
    </div>
  )
}
