import { ClipboardList } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'

export default function DischargePage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center animate-fade-in p-4 text-center">
      <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
        <ClipboardList className="w-12 h-12 text-orange-600" />
      </div>
      <h1 className="text-3xl font-bold text-slate-800 mb-4">ศูนย์จำหน่าย</h1>
      <p className="text-slate-500 text-lg mb-8">ระบบศูนย์จำหน่ายผู้ป่วย กำลังพัฒนา...</p>
      <Button onClick={() => navigate('/')} variant="outline" className="rounded-full px-8">กลับหน้าหลัก</Button>
    </div>
  )
}
