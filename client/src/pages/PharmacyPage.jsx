import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, CheckCircle2, Pill } from 'lucide-react'
import api from '../services/api'
import socket from '../services/socket'
import { useSound } from '../contexts/SoundContext'

export default function PharmacyPage() {
  const [patients, setPatients] = useState([])
  const [historyPatients, setHistoryPatients] = useState([])
  const [activeTab, setActiveTab] = useState('pending')
  const [loading, setLoading] = useState(false)
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0])
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()
  const { playAlert } = useSound()

  const filterPatients = (list) => {
    const term = searchTerm.trim()
    if (!term) return list
    return list.filter(p => p.hn === term || p.an === term)
  }

  const displayedPending = filterPatients(patients)
  const displayedHistory = filterPatients(historyPatients)

  const fetchPatients = async () => {
    setLoading(true)
    try {
      const [pendingRes, historyRes] = await Promise.all([
        api.get('/workflow/pharmacy'),
        api.get(`/workflow/pharmacy/history?date=${historyDate}`)
      ])
      setPatients(pendingRes.data)
      setHistoryPatients(historyRes.data)
    } catch (err) {
      console.error('Fetch pharmacy patients error:', err)
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
    const onUpdate = (data) => {
      fetchPatients()
      if (data && data.status === 'pharmacy') {
        playAlert()
      }
    }
    socket.on('workflow:updated', onUpdate)

    return () => {
      socket.off('workflow:updated', onUpdate)
    }
  }, [historyDate, playAlert])

  const handlePharmacyCheck = async (patient, type) => {
    try {
      await api.post(`/workflow/${patient.an}/pharmacy-check`, { type })
      
      const nextPharChkHm = type === 'hm' ? 1 : patient.phar_chk_hm;
      const nextPharChkReturn = type === 'returnmed' ? 1 : patient.phar_chk_returnmed;
      
      const hmDone = patient.chk_hm === 0 || nextPharChkHm === 1;
      const returnDone = patient.chk_returnmed === 0 || nextPharChkReturn === 1;
      
      if (hmDone && returnDone) {
        await api.post(`/workflow/${patient.an}/pharmacy-done`)
        setPatients(prev => prev.filter(p => p.an !== patient.an))
      }
      
      fetchPatients()
    } catch (err) {
      alert('ไม่สามารถทำรายการได้')
    }
  }

  const handleDone = async (an) => {
    if (!confirm('ยืนยันเสร็จสิ้นห้องยา?')) return
    try {
      await api.post(`/workflow/${an}/pharmacy-done`)
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
          <div className="bg-green-50 p-2 rounded-xl border border-green-100">
            <Pill className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-500 to-emerald-600">
              ห้องยา
            </h1>
            <p className="text-muted-foreground mt-1">ผู้ป่วยที่รอดำเนินการ จำนวน {patients.length} ราย</p>
          </div>
        </div>
        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder="ค้นหา HN หรือ AN"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-card"
          />
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
                  <th className="px-4 py-3">ชื่อ-สกุล</th>
                  <th className="px-4 py-3">อายุ</th>
                  <th className="px-4 py-3">หอผู้ป่วย</th>
                  <th className="px-4 py-3">เบอร์โทรศัพท์</th>
                  <th className="px-4 py-3">สิทธิ์การรักษา</th>
                  <th className="px-4 py-3">แพทย์</th>
                  <th className="px-4 py-3 text-center">Homemed</th>
                  <th className="px-4 py-3 text-center rounded-tr-lg">ยาคืน</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="12" className="px-4 py-8 text-center text-muted-foreground">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : displayedPending.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="px-4 py-8 text-center text-muted-foreground">
                      {searchTerm ? 'ไม่พบผู้ป่วยที่ค้นหา (กรุณาพิมพ์ให้ครบ)' : 'ไม่มีผู้ป่วยรอรับยา'}
                    </td>
                  </tr>
                ) : (
                  displayedPending.map((p) => (
                    <tr 
                      key={p.an} 
                      onClick={() => navigate(`/dcdetail/${p.an}`)}
                      className="border-t border-border hover:bg-muted/30 transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {p.sent_pharmacy_date ? new Date(p.sent_pharmacy_date).toLocaleString('th-TH', { 
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit' 
                        }) : '-'} น.
                      </td>
                      <td className="px-4 py-3 font-medium text-blue-600">{p.an}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.hn}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.pname}{p.fname} {p.lname}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.age_y ? p.age_y + ' ปี' : '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.ward_name || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.ward_phone || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="line-clamp-1">{p.pttype_name || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.doctor_name || '-'}</td>
                      <td className="px-4 py-3 text-center align-middle">
                        {p.chk_hm === 1 ? (
                          p.phar_chk_hm ? (
                            <div className="flex flex-col items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="w-5 h-5" />
                              <span className="text-[10px] whitespace-nowrap">เสร็จแล้ว</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <div className="text-amber-600 font-medium text-xs whitespace-nowrap">มี HM</div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handlePharmacyCheck(p, 'hm'); }}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] whitespace-nowrap rounded border border-blue-200"
                              >
                                กดเมื่อเสร็จ
                              </button>
                            </div>
                          )
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center align-middle">
                        {p.chk_returnmed === 1 ? (
                          p.phar_chk_returnmed ? (
                            <div className="flex flex-col items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="w-5 h-5" />
                              <span className="text-[10px] whitespace-nowrap">เสร็จแล้ว</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <div className="text-amber-600 font-medium text-xs whitespace-nowrap">มียาคืน</div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handlePharmacyCheck(p, 'returnmed'); }}
                                className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-600 text-[10px] whitespace-nowrap rounded border border-purple-200"
                              >
                                กดเมื่อเสร็จ
                              </button>
                            </div>
                          )
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
                  <th className="px-4 py-3">ชื่อ-สกุล</th>
                  <th className="px-4 py-3">อายุ</th>
                  <th className="px-4 py-3">หอผู้ป่วย</th>
                  <th className="px-4 py-3">เบอร์โทรศัพท์</th>
                  <th className="px-4 py-3 text-center">Homemed</th>
                  <th className="px-4 py-3 text-center">ยาคืน</th>
                  <th className="px-4 py-3">สถานะปัจจุบัน</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="12" className="px-4 py-8 text-center text-muted-foreground">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : displayedHistory.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="px-4 py-8 text-center text-muted-foreground">
                      {searchTerm ? 'ไม่พบผู้ป่วยที่ค้นหา (กรุณาพิมพ์ให้ครบ)' : 'ไม่มีประวัติผู้ป่วย'}
                    </td>
                  </tr>
                ) : (
                  displayedHistory.map((p) => (
                    <tr 
                      key={p.an} 
                      onClick={() => navigate(`/dcdetail/${p.an}`)}
                      className="border-t border-border hover:bg-muted/30 transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {p.sent_pharmacy_date ? new Date(p.sent_pharmacy_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'} น.
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {p.pharmacy_done_date ? new Date(p.pharmacy_done_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'} น.
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {getWaitTime(p.sent_pharmacy_date, p.pharmacy_done_date)}
                      </td>
                      <td className="px-4 py-3 font-medium text-blue-600">{p.an}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.hn}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.pname}{p.fname} {p.lname}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.age_y ? p.age_y + ' ปี' : '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.ward_name || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.ward_phone || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {p.chk_hm === 1 ? (
                          p.phar_chk_hm ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
                          ) : (
                            <span className="text-amber-600 font-medium text-xs">ค้าง</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.chk_returnmed === 1 ? (
                          p.phar_chk_returnmed ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
                          ) : (
                            <span className="text-amber-600 font-medium text-xs">ค้าง</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
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
