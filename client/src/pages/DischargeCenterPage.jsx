import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, CheckCircle2, ClipboardList, Send } from 'lucide-react'
import api from '../services/api'
import socket from '../services/socket'

export default function DischargeCenterPage() {
  const [patients, setPatients] = useState([])
  const [historyPatients, setHistoryPatients] = useState([])
  const [activeTab, setActiveTab] = useState('pending')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const fetchPatients = async () => {
    setLoading(true)
    try {
      const [pendingRes, historyRes] = await Promise.all([
        api.get('/workflow/discharge-center'),
        api.get('/workflow/discharge-center/history')
      ])
      setPatients(pendingRes.data)
      setHistoryPatients(historyRes.data)
    } catch (err) {
      console.error('Fetch discharge center patients error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getWaitTime = (start, end) => {
    if (!start || !end) return '-'
    const diffMs = new Date(end) - new Date(start)
    if (diffMs < 0) return '-'
    const diffMins = Math.floor(diffMs / 60000)
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    if (hours > 0) return `${hours} ชม. ${mins} นาที`
    return `${mins} นาที`
  }

  useEffect(() => {
    fetchPatients()

    socket.on('workflow:updated', () => {
      fetchPatients()
    })

    return () => {
      socket.off('workflow:updated')
    }
  }, [])

  const handleDone = async (an) => {
    if (!confirm('ยืนยันเสร็จสิ้นศูนย์จำหน่าย?')) return
    try {
      await api.post(`/workflow/${an}/dc-done`)
      setPatients(prev => prev.filter(p => p.an !== an))
    } catch (err) {
      alert('ไม่สามารถทำรายการได้')
    }
  }

  const handleSendFinance = async (an) => {
    if (!confirm('ยืนยันส่งการเงิน?')) return
    try {
      await api.post(`/workflow/${an}/send-finance`)
      setPatients(prev => prev.filter(p => p.an !== an))
    } catch (err) {
      alert('ไม่สามารถทำรายการได้')
    }
  }

  const formatMoney = (val) => {
    if (val === null || val === undefined) return '0.00'
    return Number(val).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return (
    <div className="w-full px-4 py-6 space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-orange-50 p-2 rounded-xl border border-orange-100">
            <ClipboardList className="w-8 h-8 text-orange-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-amber-600">
              ศูนย์จำหน่าย
            </h1>
            <p className="text-muted-foreground mt-1">ผู้ป่วยที่ศูนย์จำหน่าย จำนวน {patients.length} ราย</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-border">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'pending'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          รอดำเนินการ ({patients.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          ประวัติวันนี้ ({historyPatients.length})
        </button>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'pending' ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">เวลาที่ส่ง</th>
                  <th className="px-4 py-3">AN</th>
                  <th className="px-4 py-3">HN</th>
                  <th className="px-4 py-3">ชื่อ-สกุล</th>
                  <th className="px-4 py-3">อายุ</th>
                  <th className="px-4 py-3">หอผู้ป่วย</th>
                  <th className="px-4 py-3">สิทธิ์การรักษา</th>
                  <th className="px-4 py-3">แพทย์</th>
                  <th className="px-4 py-3 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className="px-4 py-8 text-center text-muted-foreground">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : patients.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-4 py-8 text-center text-muted-foreground">
                      ไม่มีผู้ป่วยที่ศูนย์จำหน่าย
                    </td>
                  </tr>
                ) : (
                  patients.map((p) => (
                    <tr 
                      key={p.an} 
                      onClick={() => navigate(`/dcdetail/${p.an}`)}
                      className="border-t border-border hover:bg-muted/30 transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {p.sent_dc_date ? new Date(p.sent_dc_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'} น.
                      </td>
                      <td className="px-4 py-3 font-medium text-blue-600">{p.an}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.hn}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.pname}{p.fname} {p.lname}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.age_y ? p.age_y + ' ปี' : '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.ward_name || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="line-clamp-1">{p.pttype_name || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.doctor_name || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSendFinance(p.an); }}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 h-9 px-3"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            ส่งการเงิน
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDone(p.an); }}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-emerald-600 text-white hover:bg-emerald-700 h-9 px-3"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            เสร็จสิ้น
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">เวลาที่ส่ง</th>
                  <th className="px-4 py-3">เวลาเสร็จ</th>
                  <th className="px-4 py-3">ระยะเวลารอคอย</th>
                  <th className="px-4 py-3">AN</th>
                  <th className="px-4 py-3">HN</th>
                  <th className="px-4 py-3">ชื่อ-สกุล</th>
                  <th className="px-4 py-3">อายุ</th>
                  <th className="px-4 py-3">หอผู้ป่วย</th>
                  <th className="px-4 py-3">สถานะปัจจุบัน</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className="px-4 py-8 text-center text-muted-foreground">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : historyPatients.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-4 py-8 text-center text-muted-foreground">
                      ไม่มีประวัติผู้ป่วย
                    </td>
                  </tr>
                ) : (
                  historyPatients.map((p) => (
                    <tr 
                      key={p.an} 
                      onClick={() => navigate(`/dcdetail/${p.an}`)}
                      className="border-t border-border hover:bg-muted/30 transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {p.sent_dc_date ? new Date(p.sent_dc_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'} น.
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {p.dc_done_date ? new Date(p.dc_done_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'} น.
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {getWaitTime(p.sent_dc_date, p.dc_done_date)}
                      </td>
                      <td className="px-4 py-3 font-medium text-blue-600">{p.an}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.hn}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.pname}{p.fname} {p.lname}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.age_y ? p.age_y + ' ปี' : '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.ward_name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          p.workflow_status === 'pharmacy' ? 'bg-blue-100 text-blue-700' :
                          p.workflow_status === 'discharge_center' ? 'bg-purple-100 text-purple-700' :
                          p.workflow_status === 'finance' ? 'bg-amber-100 text-amber-700' :
                          p.workflow_status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {p.workflow_status === 'pharmacy' ? 'ห้องยา' :
                           p.workflow_status === 'discharge_center' ? 'ศูนย์จำหน่าย' :
                           p.workflow_status === 'finance' ? 'การเงิน' :
                           p.workflow_status === 'completed' ? 'เสร็จสิ้น' :
                           'รอดำเนินการ'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
