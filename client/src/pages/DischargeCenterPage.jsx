import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  User, CheckCircle2, ClipboardList, Send, AlertTriangle, 
  Building2, Bed, Phone 
} from 'lucide-react'
import api from '../services/api'
import socket from '../services/socket'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'

export default function DischargeCenterPage() {
  const [patients, setPatients] = useState([])
  const [historyPatients, setHistoryPatients] = useState([])
  const [allDischargedPatients, setAllDischargedPatients] = useState([])
  const [activeTab, setActiveTab] = useState('pending')
  const [loading, setLoading] = useState(false)
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0])
  const [allDischargeDate, setAllDischargeDate] = useState(new Date().toISOString().split('T')[0])
  const [allStatusSortConfig, setAllStatusSortConfig] = useState({ key: 'discharge_date', direction: 'desc' })
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()
  const POLL_INTERVAL = Number(import.meta.env.VITE_POLL_INTERVAL || 6)
  const [waitingPatient, setWaitingPatient] = useState(null)
  const [countdown, setCountdown] = useState(POLL_INTERVAL)
  const [lockAlertInfo, setLockAlertInfo] = useState(null)
  
  const { user } = useAuth()
  const { playAlert } = useSound()
  const [lockedCases, setLockedCases] = useState({})

  const fetchPatients = async () => {
    setLoading(true)
    try {
      const [pendingRes, historyRes, allDischargedRes] = await Promise.all([
        api.get('/workflow/discharge-center'),
        api.get(`/workflow/discharge-center/history?date=${historyDate}`),
        api.get(`/workflow/all-discharged?date=${allDischargeDate}`)
      ])
      setPatients(pendingRes.data || [])
      setHistoryPatients(historyRes.data || [])
      setAllDischargedPatients(allDischargedRes.data || [])
    } catch (err) {
      console.error('Fetch discharge center patients error:', err)
    } finally {
      setLoading(false)
    }
  }

  const filterPatients = (list) => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return list || []
    return (list || []).filter(p => 
      (p.hn && p.hn.toLowerCase().includes(term)) || 
      (p.an && p.an.toLowerCase().includes(term)) ||
      (p.fname && p.fname.toLowerCase().includes(term)) ||
      (p.lname && p.lname.toLowerCase().includes(term)) ||
      (p.ward_name && p.ward_name.toLowerCase().includes(term)) ||
      (p.ward_phone && p.ward_phone.toLowerCase().includes(term))
    )
  }

  const displayedPending = filterPatients(patients)
  const displayedHistory = filterPatients(historyPatients)

  const handleAllStatusSort = (key) => {
    let direction = 'asc'
    if (allStatusSortConfig.key === key && allStatusSortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setAllStatusSortConfig({ key, direction })
  }

  const sortedAllDischarged = [...filterPatients(allDischargedPatients)].sort((a, b) => {
    let aVal = a[allStatusSortConfig.key]
    let bVal = b[allStatusSortConfig.key]

    if (allStatusSortConfig.key === 'fname') {
      aVal = `${a.pname || ''}${a.fname || ''} ${a.lname || ''}`
      bVal = `${b.pname || ''}${b.fname || ''} ${b.lname || ''}`
    }

    if (allStatusSortConfig.key === 'age_y') {
      aVal = Number(a.age_y || 0)
      bVal = Number(b.age_y || 0)
    }

    if (aVal === bVal) return 0
    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1

    if (allStatusSortConfig.direction === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  })

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
  }, [historyDate, allDischargeDate])

  useEffect(() => {
    socket.emit('get:locks', (locks) => {
      if (locks) setLockedCases(locks)
    })

    const onLocked = ({ an, userName }) => setLockedCases(prev => ({ ...prev, [an]: userName }))
    const onUnlocked = ({ an }) => setLockedCases(prev => {
      const next = { ...prev }
      delete next[an]
      return next
    })

    const onUpdate = (data) => {
      fetchPatients()
      if (data && data.status === 'discharge_center') {
        playAlert()
      }
    }

    socket.on('workflow:updated', onUpdate)
    socket.on('case:locked', onLocked)
    socket.on('case:unlocked', onUnlocked)

    return () => {
      socket.off('workflow:updated', onUpdate)
      socket.off('case:locked', onLocked)
      socket.off('case:unlocked', onUnlocked)
    }
  }, [historyDate, allDischargeDate, playAlert])

  const handleRowClick = (an) => {
    if (lockedCases[an] && lockedCases[an] !== user?.name) {
      setLockAlertInfo({ userName: lockedCases[an] });
      return;
    }
    navigate(`/dcdetail/${an}`, { state: { fromDischargeCenter: true } });
  }

  const handleDone = async (an) => {
    if (!confirm('ยืนยันเสร็จสิ้นศูนย์จำหน่าย?')) return
    try {
      await api.post(`/workflow/${an}/dc-done`)
      setPatients(prev => prev.filter(p => p.an !== an))
    } catch (err) {
      alert('ไม่สามารถทำรายการได้')
    }
  }

  const handleSendFinance = async (p) => {
    if (!p.dchdate) {
      setWaitingPatient(p)
      setCountdown(POLL_INTERVAL)
      return
    }

    if (!confirm('ยืนยันส่งการเงิน?')) return
    try {
      await api.post(`/workflow/${p.an}/send-finance`)
      setPatients(prev => prev.filter(pt => pt.an !== p.an))
    } catch (err) {
      alert('ไม่สามารถทำรายการได้')
    }
  }

  useEffect(() => {
    let timer;
    if (waitingPatient) {
      if (countdown > 0) {
        timer = setTimeout(() => setCountdown(c => c - 1), 1000)
      } else {
        // Poll API
        api.get(`/patients/${waitingPatient.an}`).then(res => {
          if (res.data && res.data.dchdate) {
            setWaitingPatient(null)
            api.post(`/workflow/${waitingPatient.an}/send-finance`).then(() => {
              setPatients(prev => prev.filter(pt => pt.an !== waitingPatient.an))
            }).catch(err => alert('ไม่สามารถทำรายการได้'))
          } else {
            setCountdown(POLL_INTERVAL)
          }
        }).catch(err => {
          console.error(err)
          setCountdown(POLL_INTERVAL)
        })
      }
    }
    return () => clearTimeout(timer)
  }, [waitingPatient, countdown])

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
            <p className="text-muted-foreground mt-1 text-sm">
              รอดำเนินการ {displayedPending.length} ราย | สถานะผู้ป่วยทั้งหมด {allDischargedPatients.length} ราย
            </p>
          </div>
        </div>
        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder="ค้นหา HN, AN หรือชื่อคนไข้"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-card"
          />
        </div>
      </div>

      <div className="flex justify-between items-center border-b border-border">
        <div className="flex space-x-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'pending'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            รอดำเนินการ ({displayedPending.length})
          </button>
          <button
            onClick={() => setActiveTab('all_status')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'all_status'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <span>สถานะผู้ป่วยทั้งหมด</span>
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
              allDischargedPatients.length > 0 ? 'bg-orange-100 text-orange-700 font-bold' : 'bg-slate-100 text-slate-600'
            }`}>
              {allDischargedPatients.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            ประวัติย้อนหลัง ({displayedHistory.length})
          </button>
        </div>
        
        {activeTab === 'all_status' && (
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">วันที่ Discharge:</span>
            <input 
              type="date" 
              value={allDischargeDate}
              onChange={(e) => setAllDischargeDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 bg-card"
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="px-2">
            <input 
              type="date" 
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'pending' ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">วันเวลาที่ส่ง</th>
                  <th className="px-4 py-3">AN</th>
                  <th className="px-4 py-3">HN</th>
                  <th className="px-4 py-3">ชื่อ-สกุล (อายุ)</th>
                  <th className="px-4 py-3">หอผู้ป่วย (เบอร์โทร)</th>
                  <th className="px-4 py-3">สิทธิ์การรักษา</th>
                  <th className="px-4 py-3">แพทย์</th>
                  <th className="px-4 py-3 text-right">กำลังตรวจสอบโดย</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-muted-foreground">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : displayedPending.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-muted-foreground">
                      {searchTerm ? 'ไม่พบผู้ป่วยที่ค้นหา' : 'ไม่มีผู้ป่วยที่ศูนย์จำหน่าย'}
                    </td>
                  </tr>
                ) : (
                  displayedPending.map((p) => (
                    <tr 
                      key={p.an} 
                      onClick={() => handleRowClick(p.an)}
                      className={`border-t border-border hover:bg-muted/30 transition-colors group cursor-pointer ${lockedCases[p.an] ? 'bg-orange-50' : ''}`}
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {p.sent_dc_date ? new Date(p.sent_dc_date).toLocaleString('th-TH', { 
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit' 
                        }) : '-'} น.
                      </td>
                      <td className="px-4 py-3 font-medium text-blue-600">{p.an}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.hn}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{p.pname}{p.fname} {p.lname}</div>
                        <div className="text-sm text-muted-foreground">อายุ {p.age_y ? p.age_y + ' ปี' : '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-900 line-clamp-1">{p.ward_name || '-'}</div>
                        {p.ward_phone && <div className="text-sm text-muted-foreground">โทร. {p.ward_phone}</div>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="line-clamp-1">{p.pttype_name || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.doctor_name || '-'}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {lockedCases[p.an] ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                            {lockedCases[p.an]}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : activeTab === 'all_status' ? (
            /* TAB: สถานะผู้ป่วยทั้งหมด (All Discharged Patients) */
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleAllStatusSort('ward_name')}>
                    หอผู้ป่วย {allStatusSortConfig.key === 'ward_name' && (allStatusSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3">เบอร์โทรหอผู้ป่วย</th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleAllStatusSort('an')}>
                    AN {allStatusSortConfig.key === 'an' && (allStatusSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleAllStatusSort('hn')}>
                    HN {allStatusSortConfig.key === 'hn' && (allStatusSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleAllStatusSort('bedno')}>
                    เตียง {allStatusSortConfig.key === 'bedno' && (allStatusSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleAllStatusSort('fname')}>
                    ชื่อ-สกุล {allStatusSortConfig.key === 'fname' && (allStatusSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-center cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleAllStatusSort('age_y')}>
                    อายุ {allStatusSortConfig.key === 'age_y' && (allStatusSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-center cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleAllStatusSort('discharge_date')}>
                    เวลาที่ Discharge {allStatusSortConfig.key === 'discharge_date' && (allStatusSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-center">มี HM</th>
                  <th className="px-4 py-3 text-center">มียาคืน</th>
                  <th className="px-4 py-3 text-center">การเงิน</th>
                  <th className="px-4 py-3 text-center">สถานะ</th>
                  <th className="px-4 py-3 text-center min-w-[200px]">คำอธิบาย</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="13" className="px-4 py-8 text-center text-muted-foreground">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : sortedAllDischarged.length === 0 ? (
                  <tr>
                    <td colSpan="13" className="px-4 py-8 text-center text-muted-foreground">
                      {searchTerm ? 'ไม่พบผู้ป่วยที่ค้นหา (กรุณาพิมพ์ให้ครบ)' : 'ไม่มีข้อมูลผู้ป่วยที่จำหน่ายในวันที่เลือก'}
                    </td>
                  </tr>
                ) : (
                  sortedAllDischarged.map((p) => {
                    const hasPayment = p.chk_payment === 1 || p.sent_finance_date || p.finance_done_date || p.workflow_status === 'finance'
                    const hasReturnMed = p.chk_returnmed === 1 || Number(p.return_drug_count || 0) > 0
                    return (
                      <tr
                        key={p.an}
                        onClick={() => navigate(`/dcdetail/${p.an}?tab=timeline`)}
                        className={`border-t border-border transition-colors group cursor-pointer ${
                          p.workflow_status === 'completed'
                            ? 'bg-emerald-50/70 hover:bg-emerald-100/70'
                            : p.workflow_status === 'ward_waiting'
                              ? 'bg-teal-50/70 hover:bg-teal-100/70'
                              : 'hover:bg-muted/30'
                        }`}
                      >
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs text-foreground font-normal">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{p.ward_name || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {p.ward_phone ? (
                            <div className="flex items-center gap-1 text-xs">
                              <Phone className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span>{p.ward_phone}</span>
                            </div>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-blue-600 whitespace-nowrap">
                          {p.an}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {p.hn}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Bed className="w-4 h-4 text-blue-500 shrink-0" />
                            <span>{p.bedno || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium whitespace-nowrap">{p.pname}{p.fname} {p.lname}</div>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground whitespace-nowrap">
                          {p.age_y ? `${p.age_y} ปี` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground whitespace-nowrap">
                          {p.discharge_date 
                            ? new Date(p.discharge_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) 
                            : p.dchtime || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.chk_hm === 1 ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" title="มี HM (ยากลับบ้าน)" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {hasReturnMed ? (
                            <CheckCircle2 className="w-5 h-5 text-amber-500 mx-auto" title="มียาคืน" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {hasPayment ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" title="ต้องไปการเงิน" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            p.workflow_status === 'pharmacy_prepare' ? 'bg-cyan-100 text-cyan-700' :
                            p.workflow_status === 'pharmacy' ? 'bg-purple-100 text-purple-700' :
                            p.workflow_status === 'discharge_center' ? 'bg-amber-100 text-amber-700' :
                            p.workflow_status === 'finance' ? 'bg-orange-100 text-orange-700' :
                            p.workflow_status === 'ward_waiting' ? 'bg-teal-100 text-teal-700' :
                            p.workflow_status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {p.workflow_status === 'pharmacy_prepare' ? 'รอจัดยา' :
                             p.workflow_status === 'pharmacy' ? 'รอจ่ายยา' :
                             p.workflow_status === 'discharge_center' ? 'ศูนย์จำหน่าย' :
                             p.workflow_status === 'finance' ? 'การเงิน' :
                             p.workflow_status === 'ward_waiting' ? 'รอกลับบ้าน' :
                             p.workflow_status === 'completed' ? 'เสร็จสิ้น' : p.workflow_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {p.workflow_status === 'ward_waiting' ? (
                            <span className="text-teal-700 font-medium">รอคนไข้กลับบ้าน (ไม่มีรายการยา HM / ค่าใช้จ่าย)</span>
                          ) : p.workflow_status === 'completed' ? (
                            <span className="text-emerald-700 font-medium">คนไข้กลับบ้านแล้ว / เสร็จสิ้นกระบวนการ</span>
                          ) : p.workflow_status === 'finance' ? (
                            <span className="text-orange-700">ส่งการเงินแล้ว (รอการเงินบันทึก)</span>
                          ) : p.workflow_status === 'discharge_center' ? (
                            <span className="text-amber-700">อยู่ที่ศูนย์จำหน่าย (รอเจ้าหน้าที่ดำเนินการ)</span>
                          ) : p.workflow_status === 'pharmacy_prepare' ? (
                            <span className="text-cyan-700">ส่งห้องยาแล้ว (รอห้องยาจัดยา)</span>
                          ) : p.workflow_status === 'pharmacy' ? (
                            <span className="text-purple-700">อยู่ที่ห้องยา (รอจ่ายยา)</span>
                          ) : '-'}
                        </td>
                      </tr>
                    )
                  })
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
                  <th className="px-4 py-3">ชื่อ-สกุล (อายุ)</th>
                  <th className="px-4 py-3">หอผู้ป่วย (เบอร์โทร)</th>
                  <th className="px-4 py-3">สิทธิ์การรักษา</th>
                  <th className="px-4 py-3">แพทย์</th>
                  <th className="px-4 py-3">กำลังตรวจสอบโดย</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-muted-foreground">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : displayedHistory.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-muted-foreground">
                      {searchTerm ? 'ไม่พบประวัติผู้ป่วยที่ค้นหา' : 'ไม่มีประวัติผู้ป่วย'}
                    </td>
                  </tr>
                ) : (
                  displayedHistory.map((p) => (
                    <tr 
                      key={p.an} 
                      onClick={() => handleRowClick(p.an)}
                      className={`border-t border-border hover:bg-muted/30 transition-colors group cursor-pointer ${lockedCases[p.an] ? 'bg-orange-50' : ''}`}
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
                        <div className="font-medium text-slate-900">{p.pname}{p.fname} {p.lname}</div>
                        <div className="text-sm text-muted-foreground">อายุ {p.age_y ? p.age_y + ' ปี' : '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-900 line-clamp-1">{p.ward_name || '-'}</div>
                        {p.ward_phone && <div className="text-sm text-muted-foreground">โทร. {p.ward_phone}</div>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="line-clamp-1">{p.pttype_name || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.doctor_name || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {lockedCases[p.an] ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                            {lockedCases[p.an]}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Waiting Popup */}
      {waitingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 relative">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-blue-500 transition-all duration-1000 ease-linear"
                    strokeWidth="3"
                    strokeDasharray={`${(countdown / POLL_INTERVAL) * 100}, 100`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-blue-600">{countdown}</span>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800">กำลังตรวจสอบข้อมูล</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  รอหอผู้ป่วย discharge ใน Hosxp
                </p>
                <p className="text-sm font-medium text-slate-700 mt-2">
                  ผู้ป่วย: {waitingPatient.pname}{waitingPatient.fname} {waitingPatient.lname}
                </p>
              </div>
              <button
                onClick={() => setWaitingPatient(null)}
                className="mt-2 w-full py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lock Alert Popup */}
      {lockAlertInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-2">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800">ไม่สามารถเข้าถึงข้อมูลได้</h3>
                <p className="text-sm text-slate-600 mt-2">
                  ผู้ป่วยรายนี้กำลังถูกตรวจสอบรายละเอียดโดย
                </p>
                <div className="mt-3 inline-flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-lg border border-orange-200 text-orange-800 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                  {lockAlertInfo.userName}
                </div>
              </div>
              <button
                onClick={() => setLockAlertInfo(null)}
                className="mt-4 w-full py-2.5 rounded-xl text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
