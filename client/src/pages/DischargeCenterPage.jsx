import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, CheckCircle2, ClipboardList, Send, AlertTriangle } from 'lucide-react'
import api from '../services/api'
import socket from '../services/socket'
import { useAuth } from '../contexts/AuthContext'

export default function DischargeCenterPage() {
  const [patients, setPatients] = useState([])
  const [historyPatients, setHistoryPatients] = useState([])
  const [activeTab, setActiveTab] = useState('pending')
  const [loading, setLoading] = useState(false)
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0])
  const navigate = useNavigate()
  const POLL_INTERVAL = Number(import.meta.env.VITE_POLL_INTERVAL || 6)
  const [waitingPatient, setWaitingPatient] = useState(null)
  const [countdown, setCountdown] = useState(POLL_INTERVAL)
  const [lockAlertInfo, setLockAlertInfo] = useState(null)
  
  const { user } = useAuth()
  const [lockedCases, setLockedCases] = useState({})

  const fetchPatients = async () => {
    setLoading(true)
    try {
      const [pendingRes, historyRes] = await Promise.all([
        api.get('/workflow/discharge-center'),
        api.get(`/workflow/discharge-center/history?date=${historyDate}`)
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
  }, [historyDate])

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

    const onUpdate = () => {
      fetchPatients()
    }

    socket.on('workflow:updated', onUpdate)
    socket.on('case:locked', onLocked)
    socket.on('case:unlocked', onUnlocked)

    return () => {
      socket.off('workflow:updated', onUpdate)
      socket.off('case:locked', onLocked)
      socket.off('case:unlocked', onUnlocked)
    }
  }, [historyDate])

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
            <p className="text-muted-foreground mt-1">ผู้ป่วยที่ศูนย์จำหน่าย จำนวน {patients.length} ราย</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center border-b border-border">
        <div className="flex space-x-1">
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
            ประวัติย้อนหลัง ({historyPatients.length})
          </button>
        </div>
        
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
                ) : patients.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-muted-foreground">
                      ไม่มีผู้ป่วยที่ศูนย์จำหน่าย
                    </td>
                  </tr>
                ) : (
                  patients.map((p) => (
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
                ) : historyPatients.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-muted-foreground">
                      ไม่มีประวัติผู้ป่วย
                    </td>
                  </tr>
                ) : (
                  historyPatients.map((p) => (
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
